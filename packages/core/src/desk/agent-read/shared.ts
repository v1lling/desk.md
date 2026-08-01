import Fuse from "fuse.js";
import { Buffer } from "buffer";
import type { Project, Workspace } from "../../types";
import { FILE_NAMES, PATH_SEGMENTS, SPECIAL_DIRS, WORKSPACE_LEVEL_PROJECT_ID } from "../constants";
import { getDeskPath, joinPath } from "../env";
import { getStorage } from "../storage";
import { getWorkspaces } from "../workspaces";
import { getProjects } from "../projects";
import { loadAIIgnoreEntries, isPathExcludedByAIIgnore } from "../aiignore";
import { AgentReadError } from "./errors";
import type { AgentProjectRef, AgentScope, AgentWorkspaceRef } from "./types";

export const MAX_SCAN_FILES = 10_000;
export const MAX_SCAN_DEPTH = 32;
export const GENERATED_WORKSPACE_FILES = new Set<string>([
  FILE_NAMES.AGENTS_MD,
  FILE_NAMES.CLAUDE_MD,
  FILE_NAMES.GEMINI_MD,
  FILE_NAMES.WORKSPACE_INDEX_MD,
]);

export const TEXT_EXTENSIONS = new Set([
  "md", "mdx", "txt", "json", "yaml", "yml", "csv", "tsv", "js", "jsx", "mjs", "cjs", "ts", "tsx",
  "html", "htm", "xml", "svg", "css", "scss", "less", "toml", "ini", "log", "sh", "zsh",
  "bash", "fish", "py", "rb", "go", "rs", "java", "kt", "kts", "swift", "sql",
]);

const MIME_TYPES: Record<string, string> = {
  md: "text/markdown", txt: "text/plain", json: "application/json", yaml: "application/yaml",
  yml: "application/yaml", csv: "text/csv", tsv: "text/tab-separated-values", html: "text/html",
  htm: "text/html", xml: "application/xml", css: "text/css", js: "text/javascript",
  jsx: "text/javascript", ts: "text/typescript", tsx: "text/typescript", pdf: "application/pdf",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  svg: "image/svg+xml", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", zip: "application/zip",
};

export interface ResolvedScope {
  workspace: Workspace;
  project?: Project;
}

export interface VisibleFile {
  path: string;
  absolutePath: string;
  extension: string;
  size: number;
}

export interface VisibleFilesResult {
  files: VisibleFile[];
  truncated: boolean;
}

export function workspaceRef(workspace: Workspace, restricted = false): AgentWorkspaceRef {
  return restricted
    ? { id: workspace.id, name: workspace.name }
    : {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        is_home: workspace.isHome,
      };
}

export function projectRef(project: Project, restricted = false): AgentProjectRef {
  return restricted
    ? { id: project.id, name: project.name }
    : {
        id: project.id,
        name: project.name,
        status: project.status,
        description: project.description,
      };
}

function suggestions<T extends { id: string; name: string }>(selector: string, values: T[]) {
  return new Fuse(values, { keys: ["id", "name"], threshold: 0.4 })
    .search(selector, { limit: 5 })
    .map(({ item }) => ({ id: item.id, name: item.name }));
}

function resolveNamed<T extends { id: string; name: string }>(
  selector: string,
  values: T[],
  kind: "Workspace" | "Project",
): T {
  const byId = values.find((value) => value.id === selector);
  if (byId) return byId;
  const folded = selector.toLocaleLowerCase();
  const byName = values.filter((value) => value.name.toLocaleLowerCase() === folded);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    throw new AgentReadError(
      "ambiguous",
      `${kind} name '${selector}' is ambiguous; use an id`,
      byName.map(({ id, name }) => ({ id, name })),
    );
  }
  throw new AgentReadError(
    "not_found",
    `${kind} '${selector}' was not found`,
    suggestions(selector, values),
  );
}

export async function resolveAgentScope(workspace: string, project?: string): Promise<ResolvedScope> {
  if (!workspace.trim()) throw new AgentReadError("invalid_argument", "workspace cannot be empty");
  const resolvedWorkspace = resolveNamed(workspace.trim(), await getWorkspaces(), "Workspace");
  if (!project) return { workspace: resolvedWorkspace };
  if (!project.trim()) throw new AgentReadError("invalid_argument", "project cannot be empty");
  return {
    workspace: resolvedWorkspace,
    project: resolveNamed(project.trim(), await getProjects(resolvedWorkspace.id), "Project"),
  };
}

export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLocaleLowerCase() : "";
}

export function mimeTypeFor(extension: string): string {
  return MIME_TYPES[extension] ?? (TEXT_EXTENSIONS.has(extension) ? "text/plain" : "application/octet-stream");
}

export function isReadableTextPath(path: string): boolean {
  return TEXT_EXTENSIONS.has(extensionOf(path));
}

export function looksLikeBinaryContent(content: string): boolean {
  const sample = content.slice(0, 8_192);
  if (sample.includes("\0")) return true;
  const replacements = [...sample].filter((character) => character === "�").length;
  return sample.length > 0 && replacements / sample.length > 0.01;
}

export function assertWorkspaceRelativePath(path: string, allowPrefix = false): string {
  const value = path.trim();
  if (!value) throw new AgentReadError("invalid_argument", "path cannot be empty");
  if (value.length > 2_000) throw new AgentReadError("invalid_argument", "path is too long");
  if (value.startsWith("/") || /^[a-zA-Z]:/.test(value) || value.includes("\\")) {
    throw new AgentReadError("invalid_argument", "path must be workspace-relative and use forward slashes");
  }
  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.startsWith("."))) {
    throw new AgentReadError("invalid_argument", "path contains a hidden or traversal segment");
  }
  if (!allowPrefix && parts.length === 1 && GENERATED_WORKSPACE_FILES.has(parts[0])) {
    throw new AgentReadError("not_found", "file is not available to agents");
  }
  return parts.join("/");
}

export async function workspaceAbsolutePath(workspaceId: string, path?: string): Promise<string> {
  const root = await joinPath(await getDeskPath(), PATH_SEGMENTS.WORKSPACES, workspaceId);
  return path ? joinPath(root, path) : root;
}

export async function assertPathVisible(workspaceId: string, path: string): Promise<void> {
  const entries = await loadAIIgnoreEntries(workspaceId);
  if (isPathExcludedByAIIgnore(path, entries)) {
    throw new AgentReadError("excluded", "This source is excluded from agent access (.aiignore)");
  }
}

export async function listVisibleWorkspaceFiles(workspaceId: string): Promise<VisibleFilesResult> {
  const root = await workspaceAbsolutePath(workspaceId);
  if (!(await getStorage().exists(root))) {
    throw new AgentReadError("not_found", `Workspace '${workspaceId}' was not found`);
  }
  const ignores = await loadAIIgnoreEntries(workspaceId);
  const files: VisibleFile[] = [];
  let truncated = false;

  const walk = async (prefix: string, depth: number): Promise<void> => {
    if (files.length >= MAX_SCAN_FILES || depth > MAX_SCAN_DEPTH) {
      truncated = true;
      return;
    }
    const directory = prefix ? await joinPath(root, prefix) : root;
    let entries;
    try {
      entries = await getStorage().readDir(directory);
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= MAX_SCAN_FILES) {
        truncated = true;
        return;
      }
      if (entry.name.startsWith(".")) continue;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!prefix && GENERATED_WORKSPACE_FILES.has(entry.name)) continue;
      if (isPathExcludedByAIIgnore(path, ignores) || (entry.isDirectory && isPathExcludedByAIIgnore(`${path}/`, ignores))) {
        continue;
      }
      if (entry.isDirectory) {
        await walk(path, depth + 1);
      } else if (entry.isFile) {
        const absolutePath = await joinPath(root, path);
        const stat = await getStorage().fileStat(absolutePath);
        files.push({ path, absolutePath, extension: extensionOf(path), size: stat?.size ?? 0 });
      }
    }
  };

  await walk("", 0);
  return { files, truncated };
}

export function isOverviewPath(path: string): boolean {
  const parts = path.split("/");
  return (
    (parts.length === 1 && parts[0] === FILE_NAMES.WORKSPACE_MD) ||
    (parts.length === 3 && parts[0] === PATH_SEGMENTS.PROJECTS && parts[2] === FILE_NAMES.PROJECT_MD)
  );
}

export function projectIdForPath(path: string): string | undefined {
  const parts = path.split("/");
  if (parts[0] === PATH_SEGMENTS.PROJECTS && parts.length >= 2) return parts[1];
  if (parts[0] === SPECIAL_DIRS.UNASSIGNED || parts[0] === SPECIAL_DIRS.CAPTURE) {
    return SPECIAL_DIRS.UNASSIGNED;
  }
  return undefined;
}

export function scopeForProjectId(projectId?: string): AgentScope {
  return projectId && projectId !== WORKSPACE_LEVEL_PROJECT_ID && projectId !== SPECIAL_DIRS.UNASSIGNED
    ? "project"
    : "workspace";
}

export function effectiveDate(entry: { updated?: string; date?: string; created?: string }): string {
  return entry.updated ?? entry.date ?? entry.created ?? "";
}

export function validateDate(value: string | undefined, field: string): void {
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AgentReadError("invalid_argument", `${field} must be YYYY-MM-DD`);
  }
}

export function normalizePrefix(prefix: string | undefined): string | undefined {
  if (!prefix) return undefined;
  return assertWorkspaceRelativePath(prefix.replace(/\/$/, ""), true);
}

export function codePoints(value: string): string[] {
  return Array.from(value);
}

interface CursorEnvelope<T> {
  v: 1;
  fingerprint: string;
  position: T;
}

export function encodeCursor<T>(fingerprint: string, position: T): string {
  const envelope: CursorEnvelope<T> = { v: 1, fingerprint, position };
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

export function decodeCursor<T>(cursor: string | undefined, fingerprint: string): T | undefined {
  if (!cursor) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as CursorEnvelope<T>;
    if (parsed.v !== 1 || parsed.fingerprint !== fingerprint || parsed.position === undefined) {
      throw new Error("mismatch");
    }
    return parsed.position;
  } catch {
    throw new AgentReadError("invalid_cursor", "cursor is invalid or does not match this query");
  }
}

export async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, "0")).join("");
}
