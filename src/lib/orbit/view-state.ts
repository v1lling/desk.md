/**
 * View State Management
 *
 * Handles per-project UI state stored in .view.json files.
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
import { PATH_SEGMENTS } from "./constants";
import type { TaskStatus } from "@/types";

// =============================================================================
// TYPES
// =============================================================================

export interface ProjectViewState {
  /** Task ordering by status column */
  taskOrder?: Record<TaskStatus, string[]>;
}

const VIEW_STATE_FILE = ".view.json";

// =============================================================================
// READ/WRITE OPERATIONS
// =============================================================================

/**
 * Get the path to a project's .view.json file
 */
async function getViewStatePath(areaId: string, projectId: string): Promise<string> {
  const orbitPath = await getOrbitPath();
  return joinPath(
    orbitPath,
    PATH_SEGMENTS.AREAS,
    areaId,
    PATH_SEGMENTS.PROJECTS,
    projectId,
    VIEW_STATE_FILE
  );
}

/**
 * Read the view state for a project
 * Returns empty object if file doesn't exist or is invalid
 */
export async function getViewState(
  areaId: string,
  projectId: string
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
    console.warn(`Failed to read view state for ${areaId}/${projectId}:`, error);
    return {};
  }
}

/**
 * Write the view state for a project
 */
export async function saveViewState(
  areaId: string,
  projectId: string,
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
  projectId: string,
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
  projectId: string,
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
 * Calculate new order array after a drag-and-drop operation
 *
 * @param currentOrder - Current order array (or undefined for default)
 * @param taskIds - All task IDs in the column
 * @param activeId - The task being dragged
 * @param overId - The task being dropped on (or column id if empty)
 * @returns New order array
 */
export function calculateNewOrder(
  currentOrder: string[] | undefined,
  taskIds: string[],
  activeId: string,
  overId: string
): string[] {
  // Start with current order or default to taskIds order
  const order = currentOrder ? [...currentOrder] : [...taskIds];

  // Filter to only include existing task IDs (cleanup stale references)
  const validOrder = order.filter(id => taskIds.includes(id));

  // Add any new tasks that aren't in the order yet
  const missingTasks = taskIds.filter(id => !validOrder.includes(id));
  const workingOrder = [...validOrder, ...missingTasks];

  // Find positions
  const activeIndex = workingOrder.indexOf(activeId);
  const overIndex = workingOrder.indexOf(overId);

  if (activeIndex === -1) {
    // Task not in order yet, add it at the over position
    if (overIndex === -1) {
      return [...workingOrder, activeId];
    }
    workingOrder.splice(overIndex, 0, activeId);
    return workingOrder;
  }

  if (overIndex === -1) {
    // Dropping at end of column
    workingOrder.splice(activeIndex, 1);
    workingOrder.push(activeId);
    return workingOrder;
  }

  // Move within the array
  workingOrder.splice(activeIndex, 1);
  workingOrder.splice(overIndex, 0, activeId);

  return workingOrder;
}

/**
 * Remove a task from all order arrays (call when deleting a task)
 */
export async function removeTaskFromOrder(
  areaId: string,
  projectId: string,
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
