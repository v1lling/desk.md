/**
 * View State Management
 *
 * Handles UI state stored in .view.json files:
 * - Per-project: workspaces/{workspace}/projects/{project}/.view.json
 * - Per-workspace (All Tasks): workspaces/{workspace}/.view.json
 *
 * This is separate from content data (markdown files) and represents
 * display preferences like task ordering within columns.
 *
 * If .view.json is missing or corrupted, the app falls back to default ordering.
 */

import {
  getOrbitPath,
  readTextFile,
  writeTextFile,
  joinPath,
  exists,
} from "./tauri-fs";
import { PATH_SEGMENTS, FILE_NAMES, PERSONAL_SPACE_ID } from "./constants";
import type { TaskStatus, ProjectViewState, TaskViewMode } from "@/types";

// Re-export type for external use (canonical definition in @/types)
export type { ProjectViewState } from "@/types";

// =============================================================================
// READ/WRITE OPERATIONS
// =============================================================================

/**
 * Get the path to a .view.json file
 * - Personal space: personal/.view.json
 * - If projectId is provided: workspaces/{workspace}/projects/{project}/.view.json
 * - If projectId is null: workspaces/{workspace}/.view.json (for All Tasks view)
 */
async function getViewStatePath(
  workspaceId: string,
  projectId: string | null
): Promise<string> {
  const orbitPath = await getOrbitPath();

  // Personal space view state
  if (workspaceId === PERSONAL_SPACE_ID) {
    return await joinPath(
      orbitPath,
      PATH_SEGMENTS.PERSONAL,
      FILE_NAMES.VIEW_STATE
    );
  }

  if (projectId) {
    // Project-level view state
    return await joinPath(
      orbitPath,
      PATH_SEGMENTS.WORKSPACES,
      workspaceId,
      PATH_SEGMENTS.PROJECTS,
      projectId,
      FILE_NAMES.VIEW_STATE
    );
  }

  // Workspace-level view state (All Tasks)
  return await joinPath(
    orbitPath,
    PATH_SEGMENTS.WORKSPACES,
    workspaceId,
    FILE_NAMES.VIEW_STATE
  );
}

/**
 * Read the view state for a project or workspace
 * @param workspaceId - The workspace ID
 * @param projectId - The project ID, or null for workspace-level (All Tasks)
 * Returns empty object if file doesn't exist or is invalid
 */
export async function getViewState(
  workspaceId: string,
  projectId: string | null
): Promise<ProjectViewState> {
  try {
    const path = await getViewStatePath(workspaceId, projectId);

    if (!(await exists(path))) {
      return {};
    }

    const content = await readTextFile(path);
    const parsed = JSON.parse(content);

    // Validate structure
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }

    return parsed as ProjectViewState;
  } catch (error) {
    // If file is corrupted or unreadable, return empty state
    const location = projectId ? `${workspaceId}/${projectId}` : workspaceId;
    console.warn(`Failed to read view state for ${location}:`, error);
    return {};
  }
}

/**
 * Write the view state for a project or workspace
 */
export async function saveViewState(
  workspaceId: string,
  projectId: string | null,
  state: ProjectViewState
): Promise<void> {
  const path = await getViewStatePath(workspaceId, projectId);
  await writeTextFile(path, JSON.stringify(state, null, 2));
}

/**
 * Update just the task order in view state
 * Merges with existing state to preserve other settings
 */
export async function updateTaskOrder(
  workspaceId: string,
  projectId: string | null,
  taskOrder: Record<TaskStatus, string[]>
): Promise<void> {
  const existing = await getViewState(workspaceId, projectId);
  await saveViewState(workspaceId, projectId, {
    ...existing,
    taskOrder,
  });
}

/**
 * Get task order for a specific status column
 * Returns undefined if no custom order is set
 */
export async function getTaskOrderForStatus(
  workspaceId: string,
  projectId: string | null,
  status: TaskStatus
): Promise<string[] | undefined> {
  const state = await getViewState(workspaceId, projectId);
  return state.taskOrder?.[status];
}

// =============================================================================
// SORTING HELPERS
// =============================================================================

/**
 * Sort tasks by custom order from view state
 * Tasks not in the order array are appended at the end (by created date)
 */
export function sortTasksByOrder<T extends { id: string; created: string }>(
  tasks: T[],
  order: string[] | undefined
): T[] {
  if (!order || order.length === 0) {
    // No custom order - sort by created date (newest first)
    return [...tasks].sort((a, b) =>
      new Date(b.created).getTime() - new Date(a.created).getTime()
    );
  }

  // Create a map of id -> index for O(1) lookup
  const orderMap = new Map(order.map((id, index) => [id, index]));

  return [...tasks].sort((a, b) => {
    const aIndex = orderMap.get(a.id);
    const bIndex = orderMap.get(b.id);

    // Both have custom order
    if (aIndex !== undefined && bIndex !== undefined) {
      return aIndex - bIndex;
    }

    // Only a has custom order - a comes first
    if (aIndex !== undefined) return -1;

    // Only b has custom order - b comes first
    if (bIndex !== undefined) return 1;

    // Neither has custom order - sort by created date (newest first)
    return new Date(b.created).getTime() - new Date(a.created).getTime();
  });
}

/**
 * Remove a task from all order arrays (call when deleting a task)
 */
export async function removeTaskFromOrder(
  workspaceId: string,
  projectId: string | null,
  taskId: string
): Promise<void> {
  const state = await getViewState(workspaceId, projectId);

  if (!state.taskOrder) return;

  const newOrder: Record<TaskStatus, string[]> = {
    todo: (state.taskOrder.todo || []).filter(id => id !== taskId),
    doing: (state.taskOrder.doing || []).filter(id => id !== taskId),
    waiting: (state.taskOrder.waiting || []).filter(id => id !== taskId),
    done: (state.taskOrder.done || []).filter(id => id !== taskId),
  };

  await saveViewState(workspaceId, projectId, {
    ...state,
    taskOrder: newOrder,
  });
}

// =============================================================================
// VIEW MODE HELPERS
// =============================================================================

/**
 * Get the view mode for tasks (list or kanban)
 * @param workspaceId - The workspace ID (or PERSONAL_SPACE_ID for personal)
 * @param projectId - The project ID, or null for workspace-level
 * @param defaultMode - Default if not set (personal=list, projects=kanban)
 */
export async function getViewMode(
  workspaceId: string,
  projectId: string | null,
  defaultMode: TaskViewMode = 'kanban'
): Promise<TaskViewMode> {
  const state = await getViewState(workspaceId, projectId);
  return state.viewMode ?? defaultMode;
}

/**
 * Set the view mode for tasks
 */
export async function setViewMode(
  workspaceId: string,
  projectId: string | null,
  viewMode: TaskViewMode
): Promise<void> {
  const existing = await getViewState(workspaceId, projectId);
  await saveViewState(workspaceId, projectId, {
    ...existing,
    viewMode,
  });
}

/**
 * Get personal space view state
 * Convenience function for personal space operations
 */
export async function getPersonalViewState(): Promise<ProjectViewState> {
  return getViewState(PERSONAL_SPACE_ID, null);
}

/**
 * Save personal space view state
 */
export async function savePersonalViewState(state: ProjectViewState): Promise<void> {
  return saveViewState(PERSONAL_SPACE_ID, null, state);
}

// =============================================================================
// DOC FOLDER EXPANSION HELPERS
// =============================================================================

/**
 * Get expanded folder paths for doc tree
 */
export async function getExpandedDocFolders(
  workspaceId: string,
  projectId: string | null
): Promise<string[]> {
  const state = await getViewState(workspaceId, projectId);
  return state.expandedDocFolders ?? [];
}

/**
 * Save expanded folder paths for doc tree
 */
export async function setExpandedDocFolders(
  workspaceId: string,
  projectId: string | null,
  folders: string[]
): Promise<void> {
  const existing = await getViewState(workspaceId, projectId);
  await saveViewState(workspaceId, projectId, {
    ...existing,
    expandedDocFolders: folders,
  });
}
