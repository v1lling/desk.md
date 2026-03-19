use crate::app_config;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, OnceLock};

const MAX_READ_CHARS: usize = 20_000;
const MAX_SEARCH_RESULTS: usize = 100;
const MAX_SEARCH_DEPTH: usize = 8;
const MAX_TREE_ENTRIES: usize = 500;

const TREE_EXCLUDED_FILES: &[&str] = &[
    "AGENTS.md",
    "CLAUDE.md",
    "WORKSPACE_CONTEXT.md",
    "workspace.md",
    "project.md",
];

static DATA_ROOT: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();

#[derive(Debug, Clone, Serialize)]
pub struct DeskReadResult {
    pub path: String,
    pub content: String,
    pub total_chars: usize,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SearchMatch {
    pub path: String,
    pub line: usize,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeskSearchResult {
    pub query: String,
    pub path: String,
    pub total_files_scanned: usize,
    pub truncated: bool,
    pub matches: Vec<SearchMatch>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceInfo {
    pub id: String,
    pub name: String,
    pub projects: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeskWorkspaceInfoResult {
    pub data_root: String,
    pub workspaces: Vec<WorkspaceInfo>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TreeEntry {
    pub path: String,
    pub entry_type: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TreeProjectInfo {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeskTreeResult {
    pub workspace_id: String,
    pub projects: Vec<TreeProjectInfo>,
    pub total: usize,
    pub truncated: bool,
    pub entries: Vec<TreeEntry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MutationResult {
    pub ok: bool,
    pub id: String,
    pub path: String,
    pub message: String,
}

fn data_root_store() -> &'static Mutex<Option<PathBuf>> {
    DATA_ROOT.get_or_init(|| Mutex::new(None))
}

pub fn set_data_root(path: PathBuf) {
    if let Ok(mut root) = data_root_store().lock() {
        *root = Some(path);
    }
}

pub fn resolve_data_root(cli_override: Option<PathBuf>) -> PathBuf {
    if let Some(path) = cli_override {
        return path;
    }

    if let Ok(from_env) = std::env::var("DESK_DATA_ROOT") {
        let trimmed = from_env.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    if let Ok(config) = app_config::read_shared_config() {
        let configured = config.data_path.trim();
        if !configured.is_empty() {
            return PathBuf::from(configured);
        }
    }

    default_data_root()
}

fn default_data_root() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    Path::new(&home).join("Desk")
}

pub fn get_data_root() -> PathBuf {
    if let Ok(root) = data_root_store().lock() {
        if let Some(path) = root.clone() {
            return path;
        }
    }
    resolve_data_root(None)
}

fn normalize_relative(input: &str) -> Result<PathBuf, String> {
    let candidate = if input.trim().is_empty() {
        "."
    } else {
        input.trim()
    };
    let raw = Path::new(candidate);
    if raw.is_absolute() {
        return Err("Absolute paths are not allowed".to_string());
    }

    let mut normalized = PathBuf::new();
    for comp in raw.components() {
        match comp {
            Component::CurDir => {}
            Component::Normal(part) => normalized.push(part),
            Component::ParentDir => {
                if !normalized.pop() {
                    return Err("Path escapes Desk data scope".to_string());
                }
            }
            _ => return Err("Invalid path".to_string()),
        }
    }
    Ok(normalized)
}

fn scoped_path(raw: &str) -> Result<PathBuf, String> {
    let root = get_data_root();
    let rel = normalize_relative(raw)?;
    Ok(root.join(rel))
}

fn ensure_within_root(path: &Path) -> Result<(), String> {
    let root = get_data_root();
    let root_norm = root.canonicalize().unwrap_or(root);
    let target_norm = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());

    if target_norm.starts_with(&root_norm) {
        return Ok(());
    }
    Err("Path is outside allowed Desk scope".to_string())
}

fn to_relative_string(path: &Path) -> String {
    let root = get_data_root();
    path.strip_prefix(&root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

pub fn desk_read(path: String) -> Result<DeskReadResult, String> {
    let target = scoped_path(&path)?;
    ensure_within_root(&target)?;

    let content = fs::read_to_string(&target).map_err(|e| format!("Failed to read file: {}", e))?;
    let total_chars = content.chars().count();

    let (content, truncated) = if total_chars > MAX_READ_CHARS {
        (
            content.chars().take(MAX_READ_CHARS).collect::<String>(),
            true,
        )
    } else {
        (content, false)
    };

    Ok(DeskReadResult {
        path: to_relative_string(&target),
        content,
        total_chars,
        truncated,
    })
}

fn should_search_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|ext| {
            matches!(
                ext.to_ascii_lowercase().as_str(),
                "md" | "txt" | "json" | "ts" | "tsx" | "js" | "jsx"
            )
        })
        .unwrap_or(false)
}

fn walk_search(
    base: &Path,
    query: &str,
    depth: usize,
    files_scanned: &mut usize,
    out: &mut Vec<SearchMatch>,
) -> Result<(), String> {
    if depth > MAX_SEARCH_DEPTH || out.len() >= MAX_SEARCH_RESULTS {
        return Ok(());
    }

    for entry in fs::read_dir(base).map_err(|e| format!("Failed to read directory: {}", e))? {
        if out.len() >= MAX_SEARCH_RESULTS {
            break;
        }
        let entry = match entry {
            Ok(v) => v,
            Err(_) => continue,
        };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            if name == "node_modules" || name == ".git" {
                continue;
            }
            walk_search(&path, query, depth + 1, files_scanned, out)?;
            continue;
        }

        if !should_search_file(&path) {
            continue;
        }

        *files_scanned += 1;
        let content = match fs::read_to_string(&path) {
            Ok(v) => v,
            Err(_) => continue,
        };
        for (line_idx, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(query) {
                out.push(SearchMatch {
                    path: to_relative_string(&path),
                    line: line_idx + 1,
                    text: line.trim().to_string(),
                });
                if out.len() >= MAX_SEARCH_RESULTS {
                    break;
                }
            }
        }
    }

    Ok(())
}

pub fn desk_search(query: String, path: Option<String>) -> Result<DeskSearchResult, String> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Err("Query cannot be empty".to_string());
    }

    let target = scoped_path(path.as_deref().unwrap_or("."))?;
    ensure_within_root(&target)?;

    let mut files_scanned = 0usize;
    let mut matches = Vec::new();
    walk_search(&target, &q, 0, &mut files_scanned, &mut matches)?;
    matches.sort_by(|a, b| a.path.cmp(&b.path).then(a.line.cmp(&b.line)));

    Ok(DeskSearchResult {
        query,
        path: to_relative_string(&target),
        total_files_scanned: files_scanned,
        truncated: matches.len() >= MAX_SEARCH_RESULTS,
        matches,
    })
}

fn choose_workspace_id(explicit: Option<String>) -> Result<String, String> {
    if let Some(id) = explicit {
        if !id.trim().is_empty() {
            return Ok(id);
        }
    }

    let workspaces_path = get_data_root().join("workspaces");
    let mut ids: Vec<String> = fs::read_dir(workspaces_path)
        .map_err(|e| format!("Failed to read workspaces: {}", e))?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            if entry.path().is_dir() {
                Some(entry.file_name().to_string_lossy().to_string())
            } else {
                None
            }
        })
        .collect();
    ids.sort();

    if ids.iter().any(|id| id == "_personal") {
        return Ok("_personal".to_string());
    }

    ids.into_iter()
        .next()
        .ok_or_else(|| "No workspaces found".to_string())
}

fn parse_frontmatter_name(path: &Path, fallback: &str) -> String {
    let content = match fs::read_to_string(path) {
        Ok(v) => v,
        Err(_) => return fallback.to_string(),
    };

    let mut in_frontmatter = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "---" {
            in_frontmatter = !in_frontmatter;
            continue;
        }
        if in_frontmatter {
            if let Some(rest) = trimmed.strip_prefix("name:") {
                return rest.trim().trim_matches('"').to_string();
            }
        } else {
            break;
        }
    }
    fallback.to_string()
}

pub fn desk_workspace_info(
    workspace_id: Option<String>,
) -> Result<DeskWorkspaceInfoResult, String> {
    let root = get_data_root();
    let workspaces_path = root.join("workspaces");
    let mut workspaces = Vec::new();

    let explicit: Option<HashSet<String>> = workspace_id.map(|id| {
        id.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    });

    for entry in
        fs::read_dir(&workspaces_path).map_err(|e| format!("Failed to read workspaces: {}", e))?
    {
        let entry = match entry {
            Ok(v) => v,
            Err(_) => continue,
        };
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let id = entry.file_name().to_string_lossy().to_string();
        if id.starts_with('.') {
            continue;
        }
        if let Some(filter) = explicit.as_ref() {
            if !filter.contains(&id) {
                continue;
            }
        }

        let workspace_md = path.join("workspace.md");
        let name = parse_frontmatter_name(&workspace_md, &id);

        let projects_path = path.join("projects");
        let mut projects = Vec::new();
        if projects_path.exists() {
            if let Ok(project_entries) = fs::read_dir(projects_path) {
                for project_entry in project_entries.flatten() {
                    let project_dir = project_entry.path();
                    if !project_dir.is_dir() {
                        continue;
                    }
                    let project_id = project_entry.file_name().to_string_lossy().to_string();
                    if project_id.starts_with('.') {
                        continue;
                    }
                    let project_md = project_dir.join("project.md");
                    let project_name = parse_frontmatter_name(&project_md, &project_id);
                    projects.push(project_name);
                }
            }
        }
        projects.sort();

        workspaces.push(WorkspaceInfo { id, name, projects });
    }

    workspaces.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(DeskWorkspaceInfoResult {
        data_root: root.to_string_lossy().to_string(),
        workspaces,
    })
}

// ---------------------------------------------------------------------------
// desk_tree
// ---------------------------------------------------------------------------

fn load_aiignore_patterns(path: &Path) -> Vec<String> {
    match fs::read_to_string(path) {
        Ok(content) => content
            .lines()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .collect(),
        Err(_) => Vec::new(),
    }
}

fn is_aiignore_excluded(rel: &str, patterns: &[String]) -> bool {
    for pattern in patterns {
        if rel == pattern {
            return true;
        }
        if pattern.ends_with('/') && rel.starts_with(pattern.as_str()) {
            return true;
        }
        if let Some(ext) = pattern.strip_prefix('*') {
            if rel.ends_with(ext) {
                return true;
            }
        }
    }
    false
}

fn walk_tree(
    base: &Path,
    current: &Path,
    aiignore: &[String],
    out: &mut Vec<TreeEntry>,
) {
    if out.len() >= MAX_TREE_ENTRIES {
        return;
    }

    let mut dir_entries: Vec<_> = match fs::read_dir(current) {
        Ok(entries) => entries.flatten().collect(),
        Err(_) => return,
    };
    dir_entries.sort_by_key(|e| e.file_name());

    for entry in dir_entries {
        if out.len() >= MAX_TREE_ENTRIES {
            return;
        }

        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/dirs
        if name.starts_with('.') {
            continue;
        }

        // Skip internal metadata files
        if TREE_EXCLUDED_FILES.contains(&name.as_str()) {
            continue;
        }

        let rel_path = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        // Check .aiignore
        if !aiignore.is_empty() && is_aiignore_excluded(&rel_path, aiignore) {
            continue;
        }

        let is_dir = path.is_dir();

        out.push(TreeEntry {
            path: rel_path,
            entry_type: if is_dir {
                "dir".to_string()
            } else {
                "file".to_string()
            },
            name,
        });

        if is_dir {
            walk_tree(base, &path, aiignore, out);
        }
    }
}

pub fn desk_tree(workspace_id: Option<String>, path: Option<String>) -> Result<DeskTreeResult, String> {
    let workspace_id = choose_workspace_id(workspace_id)?;
    let workspace_path = get_data_root().join("workspaces").join(&workspace_id);

    if !workspace_path.exists() {
        return Err(format!("Workspace '{}' not found", workspace_id));
    }

    // Load .aiignore patterns
    let aiignore = load_aiignore_patterns(&workspace_path.join(".aiignore"));

    // Collect project metadata
    let mut projects = Vec::new();
    let projects_dir = workspace_path.join("projects");
    if projects_dir.exists() {
        if let Ok(entries) = fs::read_dir(&projects_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if !p.is_dir() {
                    continue;
                }
                let id = entry.file_name().to_string_lossy().to_string();
                if id.starts_with('.') {
                    continue;
                }
                let project_md = p.join("project.md");
                let name = parse_frontmatter_name(&project_md, &id);
                projects.push(TreeProjectInfo { id, name });
            }
        }
    }
    projects.sort_by(|a, b| a.name.cmp(&b.name));

    // Determine walk root: full workspace or scoped subdirectory
    let walk_root = if let Some(ref sub) = path {
        let trimmed = sub.trim().trim_start_matches('/');
        if trimmed.is_empty() || trimmed == "." {
            workspace_path.clone()
        } else {
            let scoped = workspace_path.join(trimmed);
            if !scoped.exists() {
                return Err(format!("Path '{}' not found in workspace", trimmed));
            }
            scoped
        }
    } else {
        workspace_path.clone()
    };

    // Walk the workspace tree
    let mut entries = Vec::new();
    walk_tree(&workspace_path, &walk_root, &aiignore, &mut entries);

    let total = entries.len();
    let truncated = total > MAX_TREE_ENTRIES;
    if truncated {
        entries.truncate(MAX_TREE_ENTRIES);
    }

    Ok(DeskTreeResult {
        workspace_id,
        projects,
        total,
        truncated,
        entries,
    })
}

fn slugify(input: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = false;
    for ch in input.chars() {
        let keep = ch.is_ascii_alphanumeric();
        if keep {
            out.push(ch.to_ascii_lowercase());
            prev_dash = false;
        } else if !prev_dash {
            out.push('-');
            prev_dash = true;
        }
    }
    out.trim_matches('-').to_string()
}

fn ensure_workspace_exists(workspace_id: &str) -> Result<PathBuf, String> {
    let workspace_path = get_data_root().join("workspaces").join(workspace_id);
    if !workspace_path.exists() {
        return Err(format!("Workspace '{}' not found", workspace_id));
    }
    Ok(workspace_path)
}

fn project_root(workspace_id: &str, project_id: &str) -> Result<PathBuf, String> {
    let workspace = ensure_workspace_exists(workspace_id)?;
    if project_id == "_unassigned" {
        Ok(workspace.join("_unassigned"))
    } else {
        Ok(workspace.join("projects").join(project_id))
    }
}

fn parse_frontmatter(content: &str) -> (HashMap<String, String>, String) {
    let mut map = HashMap::new();
    if !content.starts_with("---\n") {
        return (map, content.to_string());
    }

    let rest = &content[4..];
    if let Some(end) = rest.find("\n---\n") {
        let fm = &rest[..end];
        for line in fm.lines() {
            if let Some((key, value)) = line.split_once(':') {
                map.insert(key.trim().to_string(), value.trim().trim_matches('"').to_string());
            }
        }
        let body = rest[end + 5..].to_string();
        return (map, body);
    }

    (map, content.to_string())
}

fn serialize_frontmatter(entries: &[(&str, String)], body: &str) -> String {
    let mut out = String::new();
    out.push_str("---\n");
    for (key, value) in entries {
        if value.is_empty() {
            continue;
        }
        out.push_str(&format!("{}: {}\n", key, value));
    }
    out.push_str("---\n");
    out.push_str(body.trim_start_matches('\n'));
    if !out.ends_with('\n') {
        out.push('\n');
    }
    out
}

fn find_markdown_file_by_id(dir: &Path, id: &str) -> Result<PathBuf, String> {
    if !dir.exists() {
        return Err(format!("Directory not found: {}", dir.display()));
    }
    for entry in fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = match entry {
            Ok(v) => v,
            Err(_) => continue,
        };
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        if path.extension().and_then(|x| x.to_str()) != Some("md") {
            continue;
        }
        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or_default();
        if stem == id {
            return Ok(path);
        }
    }
    Err(format!("Item '{}' not found", id))
}

fn write_markdown(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {}", e))?;
    }
    fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))
}

fn today_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%d").to_string()
}

pub fn desk_create_task(
    workspace_id: String,
    project_id: String,
    title: String,
    status: Option<String>,
    priority: Option<String>,
    due: Option<String>,
    content: Option<String>,
) -> Result<MutationResult, String> {
    let root = project_root(&workspace_id, &project_id)?.join("tasks");
    let id = slugify(&title);
    if id.is_empty() {
        return Err("Invalid title".to_string());
    }
    let path = root.join(format!("{}.md", id));
    ensure_within_root(&path)?;

    let body = content.unwrap_or_default();
    let markdown = serialize_frontmatter(
        &[
            ("title", title),
            ("status", status.unwrap_or_else(|| "todo".to_string())),
            ("priority", priority.unwrap_or_default()),
            ("due", due.unwrap_or_default()),
            ("created", today_iso()),
        ],
        &body,
    );
    write_markdown(&path, &markdown)?;

    Ok(MutationResult {
        ok: true,
        id: id.clone(),
        path: to_relative_string(&path),
        message: format!("Task '{}' created", id),
    })
}

pub fn desk_update_task(
    workspace_id: String,
    task_id: String,
    project_id: Option<String>,
    title: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    due: Option<String>,
    content: Option<String>,
) -> Result<MutationResult, String> {
    let base = project_id.unwrap_or_else(|| "_unassigned".to_string());
    let tasks_dir = project_root(&workspace_id, &base)?.join("tasks");
    let path = find_markdown_file_by_id(&tasks_dir, &task_id)?;
    ensure_within_root(&path)?;
    let raw = fs::read_to_string(&path).map_err(|e| format!("Failed to read task: {}", e))?;
    let (mut fm, body) = parse_frontmatter(&raw);

    if let Some(v) = title.clone() {
        fm.insert("title".to_string(), v);
    }
    if let Some(v) = status {
        fm.insert("status".to_string(), v);
    }
    if let Some(v) = priority {
        fm.insert("priority".to_string(), v);
    }
    if let Some(v) = due {
        fm.insert("due".to_string(), v);
    }
    let updated_body = content.unwrap_or(body);

    let markdown = serialize_frontmatter(
        &[
            (
                "title",
                fm.get("title").cloned().unwrap_or_else(|| task_id.clone()),
            ),
            (
                "status",
                fm.get("status").cloned().unwrap_or_else(|| "todo".to_string()),
            ),
            ("priority", fm.get("priority").cloned().unwrap_or_default()),
            ("due", fm.get("due").cloned().unwrap_or_default()),
            (
                "created",
                fm.get("created").cloned().unwrap_or_else(today_iso),
            ),
        ],
        &updated_body,
    );
    write_markdown(&path, &markdown)?;

    Ok(MutationResult {
        ok: true,
        id: task_id.clone(),
        path: to_relative_string(&path),
        message: format!("Task '{}' updated", task_id),
    })
}

pub fn desk_create_meeting(
    workspace_id: String,
    project_id: String,
    title: String,
    date: Option<String>,
    content: Option<String>,
) -> Result<MutationResult, String> {
    let root = project_root(&workspace_id, &project_id)?.join("meetings");
    let id = slugify(&title);
    if id.is_empty() {
        return Err("Invalid title".to_string());
    }
    let path = root.join(format!("{}.md", id));
    ensure_within_root(&path)?;
    let today = today_iso();
    let markdown = serialize_frontmatter(
        &[
            ("title", title),
            ("date", date.unwrap_or_else(|| today.clone())),
            ("created", today),
        ],
        &content.unwrap_or_default(),
    );
    write_markdown(&path, &markdown)?;

    Ok(MutationResult {
        ok: true,
        id: id.clone(),
        path: to_relative_string(&path),
        message: format!("Meeting '{}' created", id),
    })
}

pub fn desk_update_meeting(
    workspace_id: String,
    meeting_id: String,
    project_id: Option<String>,
    title: Option<String>,
    date: Option<String>,
    attendees: Option<Vec<String>>,
    content: Option<String>,
) -> Result<MutationResult, String> {
    let base = project_id.unwrap_or_else(|| "_unassigned".to_string());
    let meetings_dir = project_root(&workspace_id, &base)?.join("meetings");
    let path = find_markdown_file_by_id(&meetings_dir, &meeting_id)?;
    ensure_within_root(&path)?;
    let raw = fs::read_to_string(&path).map_err(|e| format!("Failed to read meeting: {}", e))?;
    let (mut fm, body) = parse_frontmatter(&raw);

    if let Some(v) = title {
        fm.insert("title".to_string(), v);
    }
    if let Some(v) = date {
        fm.insert("date".to_string(), v);
    }
    if let Some(v) = attendees {
        fm.insert("attendees".to_string(), format!("[{}]", v.join(", ")));
    }

    let markdown = serialize_frontmatter(
        &[
            (
                "title",
                fm.get("title")
                    .cloned()
                    .unwrap_or_else(|| meeting_id.clone()),
            ),
            (
                "date",
                fm.get("date").cloned().unwrap_or_else(today_iso),
            ),
            (
                "created",
                fm.get("created").cloned().unwrap_or_else(today_iso),
            ),
            ("attendees", fm.get("attendees").cloned().unwrap_or_default()),
        ],
        &content.unwrap_or(body),
    );
    write_markdown(&path, &markdown)?;

    Ok(MutationResult {
        ok: true,
        id: meeting_id.clone(),
        path: to_relative_string(&path),
        message: format!("Meeting '{}' updated", meeting_id),
    })
}

pub fn desk_create_doc(
    workspace_id: String,
    project_id: Option<String>,
    title: String,
    content: Option<String>,
) -> Result<MutationResult, String> {
    let root = if let Some(project) = project_id {
        project_root(&workspace_id, &project)?.join("docs")
    } else {
        ensure_workspace_exists(&workspace_id)?.join("docs")
    };
    let id = slugify(&title);
    if id.is_empty() {
        return Err("Invalid title".to_string());
    }
    let path = root.join(format!("{}.md", id));
    ensure_within_root(&path)?;
    let markdown = serialize_frontmatter(
        &[("title", title), ("created", today_iso())],
        &content.unwrap_or_default(),
    );
    write_markdown(&path, &markdown)?;

    Ok(MutationResult {
        ok: true,
        id: id.clone(),
        path: to_relative_string(&path),
        message: format!("Doc '{}' created", id),
    })
}

pub fn desk_update_doc(
    workspace_id: String,
    doc_id: String,
    project_id: Option<String>,
    title: Option<String>,
    content: Option<String>,
) -> Result<MutationResult, String> {
    let docs_dir = if let Some(project) = project_id {
        project_root(&workspace_id, &project)?.join("docs")
    } else {
        ensure_workspace_exists(&workspace_id)?.join("docs")
    };
    let path = find_markdown_file_by_id(&docs_dir, &doc_id)?;
    ensure_within_root(&path)?;
    let raw = fs::read_to_string(&path).map_err(|e| format!("Failed to read doc: {}", e))?;
    let (mut fm, body) = parse_frontmatter(&raw);

    if let Some(v) = title {
        fm.insert("title".to_string(), v);
    }
    let markdown = serialize_frontmatter(
        &[
            ("title", fm.get("title").cloned().unwrap_or_else(|| doc_id.clone())),
            (
                "created",
                fm.get("created").cloned().unwrap_or_else(today_iso),
            ),
        ],
        &content.unwrap_or(body),
    );
    write_markdown(&path, &markdown)?;

    Ok(MutationResult {
        ok: true,
        id: doc_id.clone(),
        path: to_relative_string(&path),
        message: format!("Doc '{}' updated", doc_id),
    })
}
