/**
 * Capture library - File system operations for capture/triage inbox
 *
 * Capture is a quick-triage area that lives inside the home workspace:
 * - Quick capture tasks to be triaged to the home workspace or any other workspace
 *
 * File structure:
 * ~/Desk/workspaces/{homeWorkspaceId}/
 *   ├── _capture/tasks/*.md    # Quick capture (triage inbox)
 *   ├── _unassigned/tasks/*.md # Tasks without a project
 *   ├── projects/              # Projects
 *   └── docs/                  # Docs
 *
 * Note: Regular tasks/docs/meetings use the normal workspace stores.
 * This file only handles the capture inbox.
 */

import type { Task, TaskStatus, TaskPriority, TaskUpdate } from "../types";
import {
  parseMarkdown,
  generateFilename,
  filenameToId,
  todayISO,
  normalizeDate,
  clearNulls,
} from "./parser";
import { isMockMode, joinPath } from "./env";
import { getStorage } from "./storage";
import {
  writeMarkdownFile,
  updateMarkdownFile,
  deleteMarkdownFile,
  moveMarkdownFile,
} from "./file-operations";
import { SPECIAL_DIRS } from "./constants";
import { getCapturePath, getTasksPath } from "./paths";
import { getHomeWorkspaceId } from "./workspaces";

// ============================================================================
// MOCK DATA
// ============================================================================

export const mockCaptureTasks: Task[] = [
  {
    id: "2024-01-16-book-dentist",
    projectId: SPECIAL_DIRS.CAPTURE,
    workspaceId: "personal",
    filePath: "~/Desk/workspaces/personal/_capture/tasks/2024-01-16-book-dentist.md",
    title: "Book dentist appointment",
    status: "todo",
    priority: "low",
    created: "2024-01-16",
    content: "Remember to book the 6-month checkup",
  },
];

// ============================================================================
// FRONTMATTER TYPES
// ============================================================================

interface TaskFrontmatter extends Record<string, unknown> {
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  due?: string;
  created: string;
}

// ============================================================================
// CAPTURE TASKS
// ============================================================================

/**
 * Get all capture tasks (quick capture inbox)
 */
export async function getCaptureTasks(): Promise<Task[]> {
  if (isMockMode()) {
    return [...mockCaptureTasks];
  }

  const capturePath = await getCapturePath();

  if (!(await getStorage().exists(capturePath))) {
    return [];
  }

  const homeWorkspaceId = await getHomeWorkspaceId();
  const entries = await getStorage().readDir(capturePath);
  const tasks: Task[] = [];

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      try {
        const taskPath = await joinPath(capturePath, entry.name);
        const content = await getStorage().readTextFile(taskPath);
        const { data, content: body } = parseMarkdown<TaskFrontmatter>(content);

        tasks.push({
          id: filenameToId(entry.name),
          projectId: SPECIAL_DIRS.CAPTURE,
          workspaceId: homeWorkspaceId,
          filePath: taskPath,
          title: data.title || entry.name,
          status: data.status || "todo",
          priority: data.priority,
          due: data.due ? normalizeDate(data.due) : undefined,
          created: normalizeDate(data.created),
          content: body,
        });
      } catch (e) {
        console.warn(`Failed to read capture task ${entry.name}:`, e);
      }
    }
  }

  return tasks;
}

/**
 * Create a capture task (quick capture)
 */
export async function createCaptureTask(data: {
  title: string;
  priority?: TaskPriority;
  due?: string;
  content?: string;
}): Promise<Task> {
  const filename = generateFilename(data.title);
  const id = filenameToId(filename);
  const homeWorkspaceId = await getHomeWorkspaceId();

  const task: Task = {
    id,
    projectId: SPECIAL_DIRS.CAPTURE,
    workspaceId: homeWorkspaceId,
    filePath: "",
    title: data.title,
    status: "todo",
    priority: data.priority,
    due: data.due,
    created: todayISO(),
    content: data.content || "",
  };

  if (isMockMode()) {
    task.filePath = `~/Desk/workspaces/${homeWorkspaceId}/_capture/tasks/${filename}`;
    mockCaptureTasks.push(task);
    return task;
  }

  const capturePath = await getCapturePath();
  const filePath = await joinPath(capturePath, filename);
  task.filePath = filePath;

  const frontmatter: TaskFrontmatter = {
    title: task.title,
    status: task.status,
    priority: task.priority,
    due: task.due,
    created: task.created,
  };

  await writeMarkdownFile(filePath, frontmatter, task.content);

  return task;
}

/**
 * Update a capture task
 */
export async function updateCaptureTask(
  taskId: string,
  updates: Omit<TaskUpdate, "projectId">
): Promise<Task | null> {
  if (isMockMode()) {
    const index = mockCaptureTasks.findIndex((t) => t.id === taskId);
    if (index === -1) return null;
    mockCaptureTasks[index] = { ...mockCaptureTasks[index], ...clearNulls(updates) };
    return mockCaptureTasks[index];
  }

  const tasks = await getCaptureTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const result = await updateMarkdownFile<TaskFrontmatter>(task.filePath, (data, body) => {
    const updatedData: TaskFrontmatter = {
      ...data,
      ...(updates.title && { title: updates.title }),
      ...(updates.status && { status: updates.status }),
      // null clears the field (→ undefined → dropped by serializeMarkdown); undefined leaves it.
      ...(updates.priority !== undefined && { priority: updates.priority ?? undefined }),
      ...(updates.due !== undefined && { due: updates.due ?? undefined }),
    };
    const updatedContent = updates.content !== undefined ? updates.content : body;
    return { frontmatter: updatedData, content: updatedContent };
  });

  if (!result) return null;

  return {
    ...task,
    ...updates,
    title: result.frontmatter.title,
    status: result.frontmatter.status,
    priority: result.frontmatter.priority,
    due: result.frontmatter.due,
    content: result.content,
  };
}

/**
 * Delete a capture task
 */
export async function deleteCaptureTask(taskId: string): Promise<boolean> {
  if (isMockMode()) {
    const index = mockCaptureTasks.findIndex((t) => t.id === taskId);
    if (index === -1) return false;
    mockCaptureTasks.splice(index, 1);
    return true;
  }

  const tasks = await getCaptureTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return false;

  return deleteMarkdownFile(task.filePath);
}

/**
 * Move task from capture to Personal workspace (unassigned)
 * This moves the task to the Personal workspace's _unassigned/tasks/ directory
 */
export async function moveCaptureToPersonal(taskId: string): Promise<Task | null> {
  if (isMockMode()) {
    const index = mockCaptureTasks.findIndex((t) => t.id === taskId);
    if (index === -1) return null;

    const [task] = mockCaptureTasks.splice(index, 1);
    return {
      ...task,
      projectId: SPECIAL_DIRS.UNASSIGNED,
    };
  }

  const tasks = await getCaptureTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const unassignedTasksPath = await getTasksPath(await getHomeWorkspaceId(), SPECIAL_DIRS.UNASSIGNED);
  const filename = task.filePath.split("/").pop()!;
  const newFilePath = await joinPath(unassignedTasksPath, filename);

  const moved = await moveMarkdownFile(task.filePath, newFilePath);
  if (!moved) return null;

  return {
    ...task,
    projectId: SPECIAL_DIRS.UNASSIGNED,
    filePath: newFilePath,
  };
}

/**
 * Move task from capture to a workspace project
 */
export async function moveCaptureToWorkspace(
  taskId: string,
  workspaceId: string,
  projectId: string
): Promise<Task | null> {
  if (isMockMode()) {
    const index = mockCaptureTasks.findIndex((t) => t.id === taskId);
    if (index === -1) return null;

    // Remove from mock capture tasks and return as workspace task
    const [task] = mockCaptureTasks.splice(index, 1);
    return {
      ...task,
      projectId,
      workspaceId,
    };
  }

  const tasks = await getCaptureTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const targetTasksPath = await getTasksPath(workspaceId, projectId);
  const filename = task.filePath.split("/").pop()!;
  const newFilePath = await joinPath(targetTasksPath, filename);

  const moved = await moveMarkdownFile(task.filePath, newFilePath);
  if (!moved) return null;

  return {
    ...task,
    projectId,
    workspaceId,
    filePath: newFilePath,
  };
}

