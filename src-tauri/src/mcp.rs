use crate::{app_config, mcp_core};
use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

const MCP_SERVER_NAME: &str = "desk-mcp";

#[derive(Serialize)]
pub struct McpStatus {
    available: bool,
    transport: String,
    command: String,
    args: Vec<String>,
    server_name: String,
    tools: Vec<String>,
    claude_config_snippet: String,
    codex_config_snippet: String,
    gemini_config_snippet: String,
    shared_config_path: String,
    data_root: String,
}

#[derive(Serialize)]
pub struct McpSelfTestResult {
    ok: bool,
    command: String,
    output: String,
}

fn tool_names() -> Vec<String> {
    vec![
        "desk_tree".to_string(),
        "desk_read".to_string(),
        "desk_search".to_string(),
        "desk_workspace_info".to_string(),
        "desk_create_task".to_string(),
        "desk_update_task".to_string(),
        "desk_create_meeting".to_string(),
        "desk_update_meeting".to_string(),
        "desk_create_doc".to_string(),
        "desk_update_doc".to_string(),
    ]
}

fn current_data_root_string() -> String {
    mcp_core::get_data_root().to_string_lossy().to_string()
}

fn sidecar_candidates(app_handle: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            #[cfg(target_os = "windows")]
            {
                candidates.push(parent.join("desk-mcp.exe"));
            }
            #[cfg(not(target_os = "windows"))]
            {
                candidates.push(parent.join("desk-mcp"));
            }
        }
    }

    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        #[cfg(target_os = "windows")]
        {
            candidates.push(resource_dir.join("desk-mcp.exe"));
        }
        #[cfg(not(target_os = "windows"))]
        {
            candidates.push(resource_dir.join("desk-mcp"));
        }
    }

    candidates
}

fn resolve_sidecar_command(app_handle: &tauri::AppHandle) -> String {
    if let Ok(explicit) = std::env::var("DESK_MCP_PATH") {
        if !explicit.trim().is_empty() {
            return explicit;
        }
    }
    let candidates = sidecar_candidates(app_handle);
    for candidate in &candidates {
        if candidate.exists() {
            return candidate.to_string_lossy().to_string();
        }
    }
    if let Some(first) = candidates.first() {
        return first.to_string_lossy().to_string();
    }
    MCP_SERVER_NAME.to_string()
}

fn build_config_snippets(command: &str, data_root: &str) -> (String, String, String) {
    let args = serde_json::to_string(&vec!["--data-root", data_root])
        .unwrap_or_else(|_| r#"["--data-root","/absolute/path/to/Desk"]"#.to_string());

    let claude = format!(
    "{{\n  \"mcpServers\": {{\n    \"desk\": {{\n      \"command\": \"{}\",\n      \"args\": {}\n    }}\n  }}\n}}",
    command, args
  );
    let codex = format!(
    "{{\n  \"mcpServers\": {{\n    \"desk\": {{\n      \"command\": \"{}\",\n      \"args\": {}\n    }}\n  }}\n}}",
    command, args
  );
    let gemini = format!(
    "{{\n  \"mcpServers\": {{\n    \"desk\": {{\n      \"command\": \"{}\",\n      \"args\": {}\n    }}\n  }}\n}}",
    command, args
  );

    (claude, codex, gemini)
}

#[tauri::command]
pub fn mcp_status(app_handle: tauri::AppHandle) -> Result<McpStatus, String> {
    let command = resolve_sidecar_command(&app_handle);
    let command_exists = {
        let path = PathBuf::from(&command);
        path.is_absolute() && path.exists()
    };
    let data_root = current_data_root_string();
    let args = vec!["--data-root".to_string(), data_root.clone()];
    let tools = tool_names();
    let (claude_config_snippet, codex_config_snippet, gemini_config_snippet) =
        build_config_snippets(&command, &data_root);
    let shared_config_path = app_config::config_file_path()?
        .to_string_lossy()
        .to_string();

    Ok(McpStatus {
        available: command_exists,
        transport: "stdio".to_string(),
        command,
        args,
        server_name: MCP_SERVER_NAME.to_string(),
        tools,
        claude_config_snippet,
        codex_config_snippet,
        gemini_config_snippet,
        shared_config_path,
        data_root,
    })
}

#[tauri::command]
pub fn mcp_self_test(app_handle: tauri::AppHandle) -> Result<McpSelfTestResult, String> {
    let command = resolve_sidecar_command(&app_handle);
    let command_path = PathBuf::from(&command);
    if command_path.is_absolute() && !command_path.exists() {
        let info = mcp_core::desk_workspace_info(None)
            .map(|result| {
                format!(
                    "sidecar_missing:true\nworkspaces:{}\ndata_root:{}",
                    result.workspaces.len(),
                    result.data_root
                )
            })
            .unwrap_or_else(|err| format!("sidecar_missing:true\nfallback_error:{}", err));
        return Ok(McpSelfTestResult {
            ok: false,
            command,
            output: info,
        });
    }

    let output = Command::new(&command)
        .arg("--data-root")
        .arg(current_data_root_string())
        .arg("--self-test")
        .output()
        .map_err(|err| format!("Failed to run MCP self-test with '{}': {}", command, err))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let merged = if stderr.is_empty() {
        stdout
    } else if stdout.is_empty() {
        stderr
    } else {
        format!("{}\n{}", stdout, stderr)
    };

    Ok(McpSelfTestResult {
        ok: output.status.success(),
        command,
        output: merged,
    })
}

#[tauri::command]
pub fn desk_tree(workspace_id: Option<String>, path: Option<String>) -> Result<mcp_core::DeskTreeResult, String> {
    mcp_core::desk_tree(workspace_id, path)
}

#[tauri::command]
pub fn desk_read(path: String) -> Result<mcp_core::DeskReadResult, String> {
    mcp_core::desk_read(path)
}

#[tauri::command]
pub fn desk_search(
    query: String,
    path: Option<String>,
) -> Result<mcp_core::DeskSearchResult, String> {
    mcp_core::desk_search(query, path)
}

#[tauri::command]
pub fn desk_workspace_info(
    workspace_id: Option<String>,
) -> Result<mcp_core::DeskWorkspaceInfoResult, String> {
    mcp_core::desk_workspace_info(workspace_id)
}

#[tauri::command]
pub fn desk_create_task(
    workspace_id: String,
    project_id: String,
    title: String,
    status: Option<String>,
    priority: Option<String>,
    due: Option<String>,
    content: Option<String>,
) -> Result<mcp_core::MutationResult, String> {
    mcp_core::desk_create_task(workspace_id, project_id, title, status, priority, due, content)
}

#[tauri::command]
pub fn desk_update_task(
    workspace_id: String,
    task_id: String,
    project_id: Option<String>,
    title: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    due: Option<String>,
    content: Option<String>,
) -> Result<mcp_core::MutationResult, String> {
    mcp_core::desk_update_task(
        workspace_id,
        task_id,
        project_id,
        title,
        status,
        priority,
        due,
        content,
    )
}

#[tauri::command]
pub fn desk_create_meeting(
    workspace_id: String,
    project_id: String,
    title: String,
    date: Option<String>,
    content: Option<String>,
) -> Result<mcp_core::MutationResult, String> {
    mcp_core::desk_create_meeting(workspace_id, project_id, title, date, content)
}

#[tauri::command]
pub fn desk_update_meeting(
    workspace_id: String,
    meeting_id: String,
    project_id: Option<String>,
    title: Option<String>,
    date: Option<String>,
    attendees: Option<Vec<String>>,
    content: Option<String>,
) -> Result<mcp_core::MutationResult, String> {
    mcp_core::desk_update_meeting(
        workspace_id,
        meeting_id,
        project_id,
        title,
        date,
        attendees,
        content,
    )
}

#[tauri::command]
pub fn desk_create_doc(
    workspace_id: String,
    project_id: Option<String>,
    title: String,
    content: Option<String>,
) -> Result<mcp_core::MutationResult, String> {
    mcp_core::desk_create_doc(workspace_id, project_id, title, content)
}

#[tauri::command]
pub fn desk_update_doc(
    workspace_id: String,
    doc_id: String,
    project_id: Option<String>,
    title: Option<String>,
    content: Option<String>,
) -> Result<mcp_core::MutationResult, String> {
    mcp_core::desk_update_doc(workspace_id, doc_id, project_id, title, content)
}
