/**
 * Workspaces library - File system operations for workspaces
 */
import type { Workspace } from "@/types";
import { parseMarkdown, serializeMarkdown, todayISO, normalizeDate } from "./parser";
import {
  isTauri,
  getDeskPath,
  readDir,
  readTextFile,
  writeTextFile,
  mkdir,
  removeDir,
  joinPath,
  exists,
} from "./tauri-fs";
import { mockWorkspaces } from "./mock-data";
import { PATH_SEGMENTS, SPECIAL_DIRS, FILE_NAMES } from "./constants";

interface WorkspaceFrontmatter {
  name: string;
  description?: string;
  color?: string;
  created: string;
}

/**
 * Get all workspaces
 */
export async function getWorkspaces(): Promise<Workspace[]> {
  if (!isTauri()) {
    return mockWorkspaces;
  }

  const deskPath = await getDeskPath();
  const workspacesPath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES);

  // Check if workspaces directory exists
  if (!(await exists(workspacesPath))) {
    return [];
  }

  const entries = await readDir(workspacesPath);
  const workspaces: Workspace[] = [];

  for (const entry of entries) {
    if (entry.isDirectory && !entry.name.startsWith(".")) {
      try {
        const workspacePath = await joinPath(workspacesPath, entry.name, FILE_NAMES.WORKSPACE_MD);
        const content = await readTextFile(workspacePath);
        const { data } = parseMarkdown<WorkspaceFrontmatter>(content);

        workspaces.push({
          id: entry.name,
          name: data.name || entry.name,
          description: data.description,
          color: data.color,
          created: normalizeDate(data.created),
        });
      } catch (e) {
        console.warn(`Failed to read workspace ${entry.name}:`, e);
      }
    }
  }

  return workspaces;
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
    const content = await readTextFile(workspacePath);
    const { data } = parseMarkdown<WorkspaceFrontmatter>(content);

    return {
      id: workspaceId,
      name: data.name || workspaceId,
      description: data.description,
      color: data.color,
      created: normalizeDate(data.created),
    };
  } catch {
    return null;
  }
}

/**
 * Create a new workspace
 */
export async function createWorkspace(data: {
  id: string;
  name: string;
  description?: string;
  color?: string;
}): Promise<Workspace> {
  const workspace: Workspace = {
    id: data.id,
    name: data.name,
    description: data.description,
    color: data.color,
    created: todayISO(),
  };

  if (!isTauri()) {
    mockWorkspaces.push(workspace);
    return workspace;
  }

  const deskPath = await getDeskPath();
  const workspacePath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, data.id);

  // Create workspace directory structure
  await mkdir(workspacePath);
  await mkdir(await joinPath(workspacePath, PATH_SEGMENTS.PROJECTS));
  await mkdir(await joinPath(workspacePath, SPECIAL_DIRS.UNASSIGNED));
  await mkdir(await joinPath(workspacePath, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.TASKS));
  await mkdir(await joinPath(workspacePath, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.DOCS));

  // Create workspace.md
  const frontmatter: WorkspaceFrontmatter = {
    name: workspace.name,
    description: workspace.description,
    color: workspace.color,
    created: workspace.created,
  };

  const markdownContent = `# ${workspace.name}

${workspace.description || ""}
`;

  const fileContent = serializeMarkdown(frontmatter, markdownContent);
  await writeTextFile(await joinPath(workspacePath, FILE_NAMES.WORKSPACE_MD), fileContent);

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
    const content = await readTextFile(workspacePath);
    const { data, content: body } = parseMarkdown<WorkspaceFrontmatter>(content);

    const updatedData: WorkspaceFrontmatter = {
      ...data,
      ...(updates.name && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.color !== undefined && { color: updates.color }),
    };

    const fileContent = serializeMarkdown(updatedData, body);
    await writeTextFile(workspacePath, fileContent);

    return {
      id: workspaceId,
      name: updatedData.name,
      description: updatedData.description,
      color: updatedData.color,
      created: updatedData.created,
    };
  } catch {
    return null;
  }
}

/**
 * Delete a workspace (removes entire directory)
 */
export async function deleteWorkspace(workspaceId: string): Promise<boolean> {
  if (!isTauri()) {
    const index = mockWorkspaces.findIndex((w) => w.id === workspaceId);
    if (index === -1) return false;
    mockWorkspaces.splice(index, 1);
    return true;
  }

  const deskPath = await getDeskPath();
  const workspacePath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, workspaceId);

  try {
    await removeDir(workspacePath);
    return true;
  } catch {
    return false;
  }
}
