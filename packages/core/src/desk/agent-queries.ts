/**
 * Agent queries — read-side filesystem operations for the in-app assistant.
 *
 * These mirror the (now-removed) Rust desk_* read commands, but run purely on
 * the StorageProvider so they work identically on the desktop and on a future
 * server. Output shapes match what the assistant tool layer expects:
 *   - deskWorkspaceInfo → { data_root, workspaces:[{ id, name, projects:[{ id, name }] }] }
 *   - deskTree          → { workspace_id, projects:[{ id, name }], total, truncated, entries[] }
 *   - deskReadFile      → { path, content, total_chars, truncated }
 *   - deskFullTextSearch→ { query, terms, path, total_files_scanned, truncated, matches[] }
 *
 * `.aiignore` enforcement is built in here (deskTree / deskReadFile /
 * deskFullTextSearch honour each workspace's exclusions), so it applies to EVERY
 * front door — the in-app assistant via DeskService and a future MCP server alike,
 * against whichever disk the domain runs on. Callers no longer need to re-filter.
 */
import { getDeskPath, joinPath } from "./env";
import { getStorage } from "./storage";
import { PATH_SEGMENTS } from "./constants";
import { getWorkspaces } from "./workspaces";
import { getProjects } from "./projects";
import { loadAIIgnoreEntries, isPathExcludedByAIIgnore } from "./aiignore";

/**
 * Split a data-root-relative path (e.g. `workspaces/<id>/docs/x.md`) into its
 * workspace id and the workspace-relative remainder, or null if it isn't under a
 * workspace. Used to apply the right workspace's `.aiignore` to a path.
 */
function splitWorkspacePath(relPath: string): { workspaceId: string; relative: string } | null {
  const parts = relPath.split("/").filter(Boolean);
  if (parts[0] === PATH_SEGMENTS.WORKSPACES && parts.length >= 2) {
    return { workspaceId: parts[1], relative: parts.slice(2).join("/") };
  }
  return null;
}

const MAX_READ_CHARS = 20_000;
const MAX_SEARCH_RESULTS = 100;
const MAX_SEARCH_DEPTH = 8;
const MAX_TREE_ENTRIES = 500;
// Per-match snippet cap (chars) — a single long line can never blow up a result.
const MAX_MATCH_TEXT_CHARS = 300;
// Per-file match cap — keep one file from dominating the result set.
const MAX_MATCHES_PER_FILE = 5;

// Internal metadata files hidden from the agent's tree view.
const TREE_EXCLUDED_FILES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  "WORKSPACE_CONTEXT.md",
  "workspace.md",
  "project.md",
]);

const SEARCHABLE_EXTENSIONS = new Set([
  "md",
  "txt",
  "json",
  "ts",
  "tsx",
  "js",
  "jsx",
]);

export interface TreeEntry {
  path: string;
  entry_type: "dir" | "file";
  name: string;
}

export interface DeskTreeResult {
  workspace_id: string;
  projects: { id: string; name: string }[];
  total: number;
  truncated: boolean;
  entries: TreeEntry[];
}

export interface DeskReadResult {
  path: string;
  content: string;
  total_chars: number;
  truncated: boolean;
}

export interface SearchMatch {
  path: string;
  line: number;
  /** The matched line, trimmed and capped at MAX_MATCH_TEXT_CHARS (with a "…" marker). */
  text: string;
}

export interface DeskSearchResult {
  query: string;
  /** The parsed query terms (lowercased); empty for a quoted phrase search. */
  terms: string[];
  path: string;
  total_files_scanned: number;
  truncated: boolean;
  matches: SearchMatch[];
}

export interface DeskWorkspaceInfoResult {
  data_root: string;
  workspaces: { id: string; name: string; projects: { id: string; name: string }[] }[];
}

/**
 * Normalize a data-root-relative path, rejecting absolute paths and any `..`
 * that escapes the root. Returns forward-slash segments joined back together.
 */
function normalizeRelative(input: string): string {
  const candidate = (input || ".").trim();
  if (candidate.startsWith("/") || /^[a-zA-Z]:/.test(candidate)) {
    throw new Error("Absolute paths are not allowed");
  }
  const out: string[] = [];
  for (const part of candidate.split(/[\\/]+/)) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.pop() === undefined) {
        throw new Error("Path escapes Desk data scope");
      }
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

// Collapse to lowercase alphanumerics (Unicode letters/digits, so umlauts survive) for
// punctuation-insensitive search: edu-id ≡ eduid ≡ edu_id, and openathens ≡ "open athens".
function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

async function safeReadDir(absPath: string) {
  try {
    return await getStorage().readDir(absPath);
  } catch {
    return [];
  }
}

/**
 * List all workspaces with their project names (no filesystem walk beyond CRUD).
 */
export async function deskWorkspaceInfo(): Promise<DeskWorkspaceInfoResult> {
  const dataRoot = await getDeskPath();
  const workspaces = await getWorkspaces();

  const result = await Promise.all(
    workspaces.map(async (ws) => {
      const projects = await getProjects(ws.id);
      return {
        id: ws.id,
        name: ws.name,
        projects: projects
          .map((p) => ({ id: p.id, name: p.name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      };
    })
  );

  return { data_root: dataRoot, workspaces: result };
}

/**
 * Flat file tree for a workspace (or a subdirectory of it), workspace-relative
 * paths. Skips hidden entries and internal metadata files; truncates at 500.
 */
export async function deskTree(
  workspaceId: string,
  subPath?: string
): Promise<DeskTreeResult> {
  const deskPath = await getDeskPath();
  const workspaceAbs = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, workspaceId);

  if (!(await getStorage().exists(workspaceAbs))) {
    throw new Error(`Workspace '${workspaceId}' not found`);
  }

  const projects = (await getProjects(workspaceId))
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const startRel = subPath ? normalizeRelative(subPath) : "";
  if (startRel && !(await getStorage().exists(await joinPath(workspaceAbs, startRel)))) {
    throw new Error(`Path '${startRel}' not found in workspace`);
  }

  const entries: TreeEntry[] = [];

  const walk = async (relPrefix: string): Promise<void> => {
    if (entries.length >= MAX_TREE_ENTRIES) return;
    const absDir = relPrefix ? await joinPath(workspaceAbs, relPrefix) : workspaceAbs;
    const dirEntries = (await safeReadDir(absDir)).sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of dirEntries) {
      if (entries.length >= MAX_TREE_ENTRIES) return;
      if (entry.name.startsWith(".")) continue;
      if (TREE_EXCLUDED_FILES.has(entry.name)) continue;

      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      entries.push({
        path: relPath,
        entry_type: entry.isDirectory ? "dir" : "file",
        name: entry.name,
      });

      if (entry.isDirectory) {
        await walk(relPath);
      }
    }
  };

  await walk(startRel);

  const truncated = entries.length >= MAX_TREE_ENTRIES;

  // Drop entries excluded by this workspace's .aiignore (paths are workspace-relative).
  const aiignoreEntries = await loadAIIgnoreEntries(workspaceId);
  const visible = aiignoreEntries.length
    ? entries.filter((e) => !isPathExcludedByAIIgnore(e.path, aiignoreEntries))
    : entries;

  return {
    workspace_id: workspaceId,
    projects,
    total: visible.length,
    truncated,
    entries: visible,
  };
}

/**
 * Read a data-root-relative file, truncated at 20k chars.
 */
export async function deskReadFile(relPath: string): Promise<DeskReadResult> {
  const deskPath = await getDeskPath();
  const normalized = normalizeRelative(relPath);

  // Block files the workspace's .aiignore excludes — before any read.
  const split = splitWorkspacePath(normalized);
  if (split && split.relative) {
    const aiignoreEntries = await loadAIIgnoreEntries(split.workspaceId);
    if (isPathExcludedByAIIgnore(split.relative, aiignoreEntries)) {
      throw new Error("This file is excluded from AI access (.aiignore)");
    }
  }

  const abs = await joinPath(deskPath, normalized);
  const content = await getStorage().readTextFile(abs);
  const totalChars = content.length;
  const truncated = totalChars > MAX_READ_CHARS;

  return {
    path: normalized,
    content: truncated ? content.slice(0, MAX_READ_CHARS) : content,
    total_chars: totalChars,
    truncated,
  };
}

/**
 * Full-text search across a data-root-relative scope.
 *
 * Two modes:
 *  - **Phrase** — wrap the query in double quotes (e.g. `"edu-ID setup"`) to match that
 *    exact substring on a line (case-insensitive).
 *  - **Terms** (default) — the query is split on whitespace into terms; a file matches only
 *    when EVERY term appears on some line of it (file-level AND), and the returned snippets
 *    are the lines containing any term. This makes multi-word research queries
 *    ("OpenAthens edu-ID Alternative") work instead of demanding a verbatim line. Terms match
 *    punctuation-insensitively (edu-id ≡ eduid ≡ edu_id, openathens ≡ "open athens").
 *
 * Skips dotfiles / node_modules / .git, generated agent files (TREE_EXCLUDED_FILES) and
 * .aiignore'd paths, scans only known text extensions. Capped at MAX_SEARCH_RESULTS total
 * matches, MAX_MATCHES_PER_FILE per file, and MAX_MATCH_TEXT_CHARS per snippet.
 */
export async function deskFullTextSearch(
  query: string,
  scopeRel?: string
): Promise<DeskSearchResult> {
  const raw = query.trim();
  if (!raw) {
    throw new Error("Query cannot be empty");
  }

  // Phrase mode when wrapped in double quotes; otherwise AND-of-terms.
  const isPhrase = raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"');
  const phrase = isPhrase ? raw.slice(1, -1).trim().toLowerCase() : "";
  const terms = isPhrase ? [] : raw.toLowerCase().split(/\s+/).filter(Boolean);
  // Punctuation-insensitive forms of the terms used for the actual matching (the response
  // still echoes the readable `terms`).
  const matchTerms = terms.map(normalizeForMatch).filter(Boolean);
  if (isPhrase ? !phrase : matchTerms.length === 0) {
    throw new Error("Query cannot be empty");
  }

  const deskPath = await getDeskPath();
  const scope = normalizeRelative(scopeRel ?? ".");

  const matches: SearchMatch[] = [];
  let filesScanned = 0;

  // .aiignore entries per workspace, loaded lazily and cached for this search.
  const aiignoreCache = new Map<string, string[]>();
  const isExcluded = async (relPath: string): Promise<boolean> => {
    const split = splitWorkspacePath(relPath);
    if (!split || !split.relative) return false;
    let entries = aiignoreCache.get(split.workspaceId);
    if (!entries) {
      entries = await loadAIIgnoreEntries(split.workspaceId);
      aiignoreCache.set(split.workspaceId, entries);
    }
    return isPathExcludedByAIIgnore(split.relative, entries);
  };

  const cap = (s: string): string =>
    s.length > MAX_MATCH_TEXT_CHARS ? `${s.slice(0, MAX_MATCH_TEXT_CHARS)}…` : s;

  const walk = async (relPrefix: string, depth: number): Promise<void> => {
    if (depth > MAX_SEARCH_DEPTH || matches.length >= MAX_SEARCH_RESULTS) return;
    const absDir = relPrefix ? await joinPath(deskPath, relPrefix) : deskPath;

    for (const entry of await safeReadDir(absDir)) {
      if (matches.length >= MAX_SEARCH_RESULTS) break;
      if (entry.name.startsWith(".")) continue;

      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

      if (entry.isDirectory) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        await walk(relPath, depth + 1);
        continue;
      }

      if (!SEARCHABLE_EXTENSIONS.has(getExtension(entry.name))) continue;
      // Skip generated agent/aggregate files so matches resolve to real source files.
      if (TREE_EXCLUDED_FILES.has(entry.name)) continue;
      if (await isExcluded(relPath)) continue;

      filesScanned += 1;
      let content: string;
      try {
        content = await getStorage().readTextFile(await joinPath(deskPath, relPath));
      } catch {
        continue;
      }

      const lines = content.split("\n");

      // File-level gate + snippet test. Phrase mode is a literal substring; terms mode
      // matches each punctuation-collapsed LINE (edu-id ≡ eduid ≡ "edu id"), and the file
      // qualifies only when every term appears on some line — collapsing per line (not the
      // whole body) keeps a term from "matching" across a line break and passing the gate
      // without ever producing a snippet.
      let lineHit: (line: string, i: number) => boolean;
      if (isPhrase) {
        if (!content.toLowerCase().includes(phrase)) continue;
        lineHit = (line) => line.toLowerCase().includes(phrase);
      } else {
        const normLines = lines.map(normalizeForMatch);
        if (!matchTerms.every((t) => normLines.some((l) => l.includes(t)))) continue;
        lineHit = (_line, i) => matchTerms.some((t) => normLines[i].includes(t));
      }

      let perFile = 0;
      for (let i = 0; i < lines.length && perFile < MAX_MATCHES_PER_FILE; i++) {
        if (lineHit(lines[i], i)) {
          matches.push({ path: relPath, line: i + 1, text: cap(lines[i].trim()) });
          perFile += 1;
          if (matches.length >= MAX_SEARCH_RESULTS) break;
        }
      }
    }
  };

  await walk(scope, 0);
  matches.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);

  return {
    query,
    terms,
    path: scope,
    total_files_scanned: filesScanned,
    truncated: matches.length >= MAX_SEARCH_RESULTS,
    matches,
  };
}
