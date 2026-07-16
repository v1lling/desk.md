/**
 * Derive {type, workspaceId, projectId} from an absolute file path.
 *
 * Pure string logic shared by the maintenance engine (classifying domain-write events on any
 * host) and the app's file watcher / query invalidator. Promoted from the app's desk-watcher so
 * the server can classify without an app dependency.
 */
import { PATH_SEGMENTS, SPECIAL_DIRS } from "./constants";

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

export type PathItemType =
  | "task"
  | "doc"
  | "meeting"
  | "context"
  | "project"
  | "workspace"
  | "view"
  | "unknown";

/**
 * A record-type dir counts only when ANCHORED where records actually live — directly under
 * the workspace root, under `_unassigned`/`_capture`, or under `projects/<id>`. An unanchored
 * substring check would classify a docs SUBFOLDER named "tasks"
 * (`.../projects/x/docs/tasks/plan.md`) as a task, and this classification is persisted into
 * the Smart Index, not just used to pick a query key.
 */
function recordDirRe(dir: string): RegExp {
  const anchor = `(?:${PATH_SEGMENTS.PROJECTS}/[^/]+/|${SPECIAL_DIRS.UNASSIGNED}/|${SPECIAL_DIRS.CAPTURE}/)?`;
  return new RegExp(`/${PATH_SEGMENTS.WORKSPACES}/[^/]+/${anchor}${dir}/`);
}

const TASKS_RE = recordDirRe(PATH_SEGMENTS.TASKS);
const DOCS_RE = recordDirRe(PATH_SEGMENTS.DOCS);
const MEETINGS_RE = recordDirRe(PATH_SEGMENTS.MEETINGS);

/**
 * e.g. ".../workspaces/foo/projects/bar/tasks/baz.md" → "task"
 */
export function getItemTypeFromPath(path: string): PathItemType {
  const p = normalizePath(path);
  if (p.endsWith(".view.json")) return "view";
  // Checked before the record types: context/ is its own layer, never a record. The
  // maintenance engine keys off this (a context write must never schedule a refresh).
  // Anchored to a workspace/project root so a docs SUBFOLDER named "context" stays a doc.
  if (/\/(workspaces|projects)\/[^/]+\/context\//.test(p)) return "context";
  if (TASKS_RE.test(p)) return "task";
  if (DOCS_RE.test(p)) return "doc";
  if (MEETINGS_RE.test(p)) return "meeting";
  if (p.includes("/projects/") && p.endsWith("project.md")) return "project";
  if (p.includes("/workspaces/") && p.endsWith("workspace.md")) return "workspace";
  return "unknown";
}

/** True when the path is in the home workspace's capture inbox. */
export function isCapturePath(path: string): boolean {
  return normalizePath(path).includes("/_capture/");
}

/**
 * e.g. ".../workspaces/my-workspace/..." → "my-workspace"
 */
export function getWorkspaceIdFromPath(path: string): string | null {
  const match = normalizePath(path).match(/\/workspaces\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * e.g. ".../workspaces/foo/projects/my-project/..." → "my-project"
 * Null for `_unassigned` / `_capture` paths (no `/projects/` segment) — deliberate: per-project
 * reactions only fire for real projects.
 */
export function getProjectIdFromPath(path: string): string | null {
  const match = normalizePath(path).match(/\/projects\/([^/]+)/);
  return match ? match[1] : null;
}
