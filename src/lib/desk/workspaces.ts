/**
 * Workspaces library - File system operations for workspaces
 *
 * A workspace is an ordinary folder under workspaces/. Exactly one workspace is
 * the "home" workspace (frontmatter `home: true`): it owns the quick-capture
 * inbox, is sorted first, and cannot be deleted. The home workspace is created
 * during onboarding like any other workspace — there is no magic folder name.
 */
import type { Workspace } from "@/types";
import { parseMarkdown, serializeMarkdown, todayISO, normalizeDate } from "./parser";
import { isTauri, getDeskPath, joinPath } from "./env";
import { getStorage } from "./storage";
import { mockWorkspaces } from "./mock-data";
import { PATH_SEGMENTS, SPECIAL_DIRS, FILE_NAMES } from "./constants";
import { writePerWorkspaceAgentFiles, writeTopLevelAgentFiles } from "@/lib/context-index/agent-context";

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
  if (!isTauri()) {
    return sortWorkspacesHomeFirst([...mockWorkspaces]);
  }

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
        const { data } = parseMarkdown<WorkspaceFrontmatter>(content);

        workspaces.push({
          id: entry.name,
          name: data.name || entry.name,
          description: data.description,
          color: data.color,
          created: normalizeDate(data.created),
          isHome: data.home === true,
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
  if (!isTauri()) {
    return mockWorkspaces.find((w) => w.id === workspaceId) || null;
  }

  const deskPath = await getDeskPath();
  const workspacePath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, workspaceId, FILE_NAMES.WORKSPACE_MD);

  try {
    const content = await getStorage().readTextFile(workspacePath);
    const { data } = parseMarkdown<WorkspaceFrontmatter>(content);

    return {
      id: workspaceId,
      name: data.name || workspaceId,
      description: data.description,
      color: data.color,
      created: normalizeDate(data.created),
      isHome: data.home === true,
    };
  } catch {
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
  color?: string;
  home?: boolean;
}): Promise<Workspace> {
  const workspace: Workspace = {
    id: data.id,
    name: data.name,
    description: data.description,
    color: data.color,
    created: todayISO(),
    isHome: data.home === true,
  };

  if (!isTauri()) {
    // In mock mode, replace an existing home workspace rather than duplicating it
    const existingHome = workspace.isHome
      ? mockWorkspaces.findIndex((w) => w.isHome)
      : -1;
    if (existingHome !== -1) {
      mockWorkspaces[existingHome] = workspace;
    } else {
      mockWorkspaces.push(workspace);
    }
    clearHomeWorkspaceCache();
    return workspace;
  }

  const deskPath = await getDeskPath();
  const workspacePath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, data.id);

  // Create workspace directory structure
  await getStorage().mkdir(workspacePath);
  await getStorage().mkdir(await joinPath(workspacePath, PATH_SEGMENTS.PROJECTS));
  await getStorage().mkdir(await joinPath(workspacePath, PATH_SEGMENTS.DOCS));
  await getStorage().mkdir(await joinPath(workspacePath, PATH_SEGMENTS.AI_DOCS));
  await getStorage().mkdir(await joinPath(workspacePath, SPECIAL_DIRS.UNASSIGNED));
  await getStorage().mkdir(await joinPath(workspacePath, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.TASKS));
  await getStorage().mkdir(await joinPath(workspacePath, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.DOCS));

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

  const markdownContent = `# ${workspace.name}

${workspace.description || ""}
`;

  const fileContent = serializeMarkdown(frontmatter, markdownContent);
  await getStorage().writeTextFile(await joinPath(workspacePath, FILE_NAMES.WORKSPACE_MD), fileContent);

  clearHomeWorkspaceCache();

  // Generate agent context files (CLAUDE.md + AGENTS.md)
  await writePerWorkspaceAgentFiles(data.id, workspace, []);
  // Update top-level files with new workspace list (fire-and-forget)
  getWorkspaces().then((workspaces) => writeTopLevelAgentFiles(workspaces)).catch(() => {});

  return workspace;
}

/**
 * Update an existing workspace
 */
export async function updateWorkspace(
  workspaceId: string,
  updates: Partial<Pick<Workspace, "name" | "description" | "color">>
): Promise<Workspace | null> {
  if (!isTauri()) {
    const index = mockWorkspaces.findIndex((w) => w.id === workspaceId);
    if (index === -1) return null;
    mockWorkspaces[index] = { ...mockWorkspaces[index], ...updates };
    return mockWorkspaces[index];
  }

  const deskPath = await getDeskPath();
  const workspacePath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, workspaceId, FILE_NAMES.WORKSPACE_MD);

  try {
    const content = await getStorage().readTextFile(workspacePath);
    const { data, content: body } = parseMarkdown<WorkspaceFrontmatter>(content);

    const updatedData: WorkspaceFrontmatter = {
      ...data,
      ...(updates.name && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.color !== undefined && { color: updates.color }),
    };

    const fileContent = serializeMarkdown(updatedData, body);
    await getStorage().writeTextFile(workspacePath, fileContent);

    return {
      id: workspaceId,
      name: updatedData.name,
      description: updatedData.description,
      color: updatedData.color,
      created: updatedData.created,
      isHome: updatedData.home === true,
    };
  } catch {
    return null;
  }
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

  if (!isTauri()) {
    const index = mockWorkspaces.findIndex((w) => w.id === workspaceId);
    if (index === -1) return false;
    mockWorkspaces.splice(index, 1);
    clearHomeWorkspaceCache();
    return true;
  }

  const deskPath = await getDeskPath();
  const workspacePath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, workspaceId);

  try {
    await getStorage().removeDir(workspacePath);
    clearHomeWorkspaceCache();
    return true;
  } catch {
    return false;
  }
}
