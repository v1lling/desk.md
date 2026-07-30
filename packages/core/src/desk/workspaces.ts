/**
 * Workspaces library - File system operations for workspaces
 *
 * A workspace is an ordinary folder under workspaces/. Exactly one workspace is
 * the "home" workspace (frontmatter `home: true`): it owns the quick-capture
 * inbox, is sorted first, and cannot be deleted. The home workspace is created
 * during onboarding like any other workspace — there is no magic folder name.
 */
import type { Workspace, WorkspaceUpdate } from "../types";
import { parseMarkdown, serializeMarkdown, todayISO } from "./parser";
import {
  decodeWorkspaceFrontmatter,
  reportFrontmatterDiagnostics,
} from "./frontmatter";
import { getDeskPath, joinPath } from "./env";
import { getStorage } from "./storage";
import { allocateUniqueName, removeDirectoryWithContents } from "./file-operations";
import { PATH_SEGMENTS, SPECIAL_DIRS, FILE_NAMES } from "./constants";
import { getAgentFileWriter } from "./agent-file-writer";
import { overviewTemplate } from "./overview";

interface WorkspaceFrontmatter {
  name: string;
  description?: string;
  color?: string;
  created: string;
  home?: boolean;
}

/**
 * Sort workspaces with the home workspace first, the rest alphabetically.
 */
function sortWorkspacesHomeFirst(workspaces: Workspace[]): Workspace[] {
  const home = workspaces.find((w) => w.isHome);
  const rest = workspaces
    .filter((w) => !w.isHome)
    .sort((a, b) => a.name.localeCompare(b.name));
  return home ? [home, ...rest] : rest;
}

// =============================================================================
// HOME WORKSPACE RESOLUTION
// The home workspace id is fixed once created (folders never move on rename),
// so it is resolved once and cached for the session.
// =============================================================================

let cachedHomeWorkspaceId: string | null = null;

/**
 * Resolve the id of the home workspace (the one with `home: true`).
 * Falls back to the oldest workspace if no workspace is flagged.
 */
export async function getHomeWorkspaceId(): Promise<string> {
  if (cachedHomeWorkspaceId) return cachedHomeWorkspaceId;

  const workspaces = await getWorkspaces();
  const home = workspaces.find((w) => w.isHome);
  if (home) {
    cachedHomeWorkspaceId = home.id;
    return home.id;
  }

  // Fallback: oldest workspace. Not cached — a flagged home may appear later.
  const fallback = [...workspaces].sort((a, b) =>
    a.created.localeCompare(b.created)
  )[0];
  if (!fallback) {
    throw new Error("No workspaces exist — cannot resolve home workspace");
  }
  return fallback.id;
}

/**
 * Clear the cached home workspace id (call after creating/deleting workspaces).
 */
export function clearHomeWorkspaceCache(): void {
  cachedHomeWorkspaceId = null;
}

// =============================================================================
// READ OPERATIONS
// =============================================================================

/**
 * Get all workspaces, home workspace first.
 */
export async function getWorkspaces(): Promise<Workspace[]> {
  const deskPath = await getDeskPath();
  const workspacesPath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES);

  if (!(await getStorage().exists(workspacesPath))) {
    return [];
  }

  const entries = await getStorage().readDir(workspacesPath);
  const workspaces: Workspace[] = [];

  for (const entry of entries) {
    if (entry.isDirectory && !entry.name.startsWith(".")) {
      try {
        const workspacePath = await joinPath(workspacesPath, entry.name, FILE_NAMES.WORKSPACE_MD);
        const content = await getStorage().readTextFile(workspacePath);
        const { data: rawData, content: body } = parseMarkdown<Record<string, unknown>>(content);
        const decoded = decodeWorkspaceFrontmatter(rawData, entry.name);
        reportFrontmatterDiagnostics("workspace", workspacePath, decoded.diagnostics);
        const data = decoded.value;

        workspaces.push({
          id: entry.name,
          name: data.name || entry.name,
          description: data.description,
          overview: body.trim() || undefined,
          color: data.color,
          created: data.created,
          isHome: data.home,
        });
      } catch (e) {
        console.warn(`Failed to read workspace ${entry.name}:`, e);
      }
    }
  }

  return sortWorkspacesHomeFirst(workspaces);
}

/**
 * Get a single workspace by ID
 */
export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const deskPath = await getDeskPath();
  const workspacePath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, workspaceId, FILE_NAMES.WORKSPACE_MD);

  try {
    const content = await getStorage().readTextFile(workspacePath);
    const { data: rawData, content: body } = parseMarkdown<Record<string, unknown>>(content);
    const decoded = decodeWorkspaceFrontmatter(rawData, workspaceId);
    reportFrontmatterDiagnostics("workspace", workspacePath, decoded.diagnostics);
    const data = decoded.value;

    return {
      id: workspaceId,
      name: data.name || workspaceId,
      description: data.description,
      overview: body.trim() || undefined,
      color: data.color,
      created: data.created,
      isHome: data.home,
    };
  } catch (error) {
    console.warn(`Failed to read workspace ${workspaceId}:`, error);
    return null;
  }
}

// =============================================================================
// WRITE OPERATIONS
// =============================================================================

/**
 * Create a new workspace.
 * When `home` is true the workspace also gets a `_capture/` quick-capture inbox
 * and is flagged with `home: true` in its frontmatter.
 */
export async function createWorkspace(data: {
  id: string;
  name: string;
  description?: string;
  overview?: string;
  color?: string;
  home?: boolean;
}): Promise<Workspace> {
  const deskPath = await getDeskPath();
  const workspacesPath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES);
  const id = await allocateUniqueName(data.id || "workspace", async (candidate) =>
    getStorage().exists(await joinPath(workspacesPath, candidate))
  );
  const workspacePath = await joinPath(workspacesPath, id);

  const overview = data.overview?.trim() || overviewTemplate(data.description);
  const workspace: Workspace = {
    id,
    name: data.name,
    description: data.description,
    overview: overview || undefined,
    color: data.color,
    created: todayISO(),
    isHome: data.home === true,
  };

  // Create workspace directory structure
  await getStorage().mkdir(workspacePath);
  await getStorage().mkdir(await joinPath(workspacePath, PATH_SEGMENTS.PROJECTS));
  await getStorage().mkdir(await joinPath(workspacePath, PATH_SEGMENTS.DOCS));
  await getStorage().mkdir(await joinPath(workspacePath, SPECIAL_DIRS.UNASSIGNED));
  await getStorage().mkdir(await joinPath(workspacePath, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.TASKS));
  await getStorage().mkdir(await joinPath(workspacePath, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.DOCS));
  await getStorage().mkdir(await joinPath(workspacePath, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.MEETINGS));

  // The home workspace owns the quick-capture inbox
  if (workspace.isHome) {
    await getStorage().mkdir(await joinPath(workspacePath, SPECIAL_DIRS.CAPTURE));
    await getStorage().mkdir(await joinPath(workspacePath, SPECIAL_DIRS.CAPTURE, PATH_SEGMENTS.TASKS));
  }

  // Create workspace.md
  const frontmatter: WorkspaceFrontmatter = {
    name: workspace.name,
    description: workspace.description,
    color: workspace.color,
    created: workspace.created,
    ...(workspace.isHome && { home: true }),
  };

  const fileContent = serializeMarkdown(frontmatter, overview);
  await getStorage().writeTextFile(await joinPath(workspacePath, FILE_NAMES.WORKSPACE_MD), fileContent);

  clearHomeWorkspaceCache();

  // Generate local agent files via the injectable
  // writer (app wires Smart Index agent files; server uses the no-op default).
  const agentWriter = getAgentFileWriter();
  await agentWriter.writePerWorkspace(workspace.id, workspace, []);
  // Update top-level files with new workspace list (fire-and-forget)
  getWorkspaces().then((workspaces) => agentWriter.writeTopLevel(workspaces)).catch(() => {});

  return workspace;
}

/**
 * Update an existing workspace
 */
export async function updateWorkspace(
  workspaceId: string,
  updates: WorkspaceUpdate
): Promise<Workspace | null> {
  const deskPath = await getDeskPath();
  const workspacePath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, workspaceId, FILE_NAMES.WORKSPACE_MD);

  if (!(await getStorage().exists(workspacePath))) return null;

  const content = await getStorage().readTextFile(workspacePath);
  const { data, content: body } = parseMarkdown<Record<string, unknown>>(content);

  const updatedData: Record<string, unknown> = {
    ...data,
    ...(updates.name && { name: updates.name }),
    // null clears the field (→ undefined → dropped by serializeMarkdown); undefined leaves it.
    ...(updates.description !== undefined && { description: updates.description ?? undefined }),
    ...(updates.color !== undefined && { color: updates.color ?? undefined }),
  };

  const newBody = updates.overview !== undefined ? (updates.overview ?? "") : body;
  const fileContent = serializeMarkdown(updatedData, newBody);
  await getStorage().writeTextFile(workspacePath, fileContent);
  const decoded = decodeWorkspaceFrontmatter(updatedData, workspaceId).value;

  return {
    id: workspaceId,
    name: decoded.name,
    description: decoded.description,
    overview: newBody.trim() || undefined,
    color: decoded.color,
    created: decoded.created,
    isHome: decoded.home,
  };
}

/**
 * Delete a workspace (removes entire directory).
 * The home workspace cannot be deleted.
 */
export async function deleteWorkspace(workspaceId: string): Promise<boolean> {
  if (workspaceId === (await getHomeWorkspaceId())) {
    console.warn("Cannot delete the home workspace");
    return false;
  }

  const deskPath = await getDeskPath();
  const workspacePath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, workspaceId);

  try {
    // Through the funnel — see deleteProject.
    const removed = await removeDirectoryWithContents(workspacePath);
    clearHomeWorkspaceCache();
    return removed;
  } catch {
    return false;
  }
}
