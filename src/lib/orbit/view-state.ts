/**
 * View State Management
 *
 * Handles UI state stored in .view.json files:
 * - Per-project: areas/{area}/projects/{project}/.view.json
 * - Per-area (All Tasks): areas/{area}/.view.json
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
import { PATH_SEGMENTS, FILE_NAMES } from "./constants";
import type { TaskStatus, ProjectViewState } from "@/types";

// Re-export type for external use (canonical definition in @/types)
export type { ProjectViewState } from "@/types";

// =============================================================================
// READ/WRITE OPERATIONS
// =============================================================================

/**
 * Get the path to a .view.json file
 * - If projectId is provided: areas/{area}/projects/{project}/.view.json
 * - If projectId is null: areas/{area}/.view.json (for All Tasks view)
 */
async function getViewStatePath(
  areaId: string,
  projectId: string | null
): Promise<string> {
  const orbitPath = await getOrbitPath();

  if (projectId) {
    // Project-level view state
    return await joinPath(
      orbitPath,
      PATH_SEGMENTS.AREAS,
      areaId,
      PATH_SEGMENTS.PROJECTS,
      projectId,
      FILE_NAMES.VIEW_STATE
    );
  }

  // Area-level view state (All Tasks)
  return await joinPath(
    orbitPath,
    PATH_SEGMENTS.AREAS,
    areaId,
    FILE_NAMES.VIEW_STATE
  );
}

/**
 * Read the view state for a project or area
 * @param areaId - The area ID
 * @param projectId - The project ID, or null for area-level (All Tasks)
 * Returns empty object if file doesn't exist or is invalid
 */
export async function getViewState(
  areaId: string,
  projectId: string | null
): Promise<ProjectViewState> {
  try {
    const path = await getViewStatePath(areaId, projectId);

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
    const location = projectId ? `${areaId}/${projectId}` : areaId;
    console.warn(`Failed to read view state for ${location}:`, error);
    return {};
  }
}

/**
 * Write the view state for a project or area
 */
export async function saveViewState(
  areaId: string,
  projectId: string | null,
  state: ProjectViewState
): Promise<void> {
  const path = await getViewStatePath(areaId, projectId);
  await writeTextFile(path, JSON.stringify(state, null, 2));
}

/**
 * Update just the task order in view state
 * Merges with existing state to preserve other settings
 */
export async function updateTaskOrder(
  areaId: string,
  projectId: string | null,
  taskOrder: Record<TaskStatus, string[]>
): Promise<void> {
  const existing = await getViewState(areaId, projectId);
  await saveViewState(areaId, projectId, {
    ...existing,
    taskOrder,
  });
}

/**
 * Get task order for a specific status column
 * Returns undefined if no custom order is set
 */
export async function getTaskOrderForStatus(
  areaId: string,
  projectId: string | null,
  status: TaskStatus
): Promise<string[] | undefined> {
  const state = await getViewState(areaId, projectId);
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
  areaId: string,
  projectId: string | null,
  taskId: string
): Promise<void> {
  const state = await getViewState(areaId, projectId);

  if (!state.taskOrder) return;

  const newOrder: Record<TaskStatus, string[]> = {
    todo: (state.taskOrder.todo || []).filter(id => id !== taskId),
    doing: (state.taskOrder.doing || []).filter(id => id !== taskId),
    waiting: (state.taskOrder.waiting || []).filter(id => id !== taskId),
    done: (state.taskOrder.done || []).filter(id => id !== taskId),
  };

  await saveViewState(areaId, projectId, {
    ...state,
    taskOrder: newOrder,
  });
}
