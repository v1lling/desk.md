/**
 * Capture library - File system operations for capture/triage inbox
 *
 * Capture is a special triage area in the Personal workspace for:
 * - Quick capture tasks to be triaged to Personal or client workspaces
 *
 * File structure (Personal is now a workspace):
 * ~/Desk/workspaces/_personal/
 *   ├── _capture/tasks/*.md    # Quick capture (triage inbox)
 *   ├── _unassigned/tasks/*.md # Personal tasks without a project
 *   ├── projects/              # Personal projects
 *   └── docs/                  # Personal docs
 *
 * Note: Personal tasks/docs/meetings use the regular workspace stores
 * with workspaceId="_personal". This file only handles capture.
 */

import type { Task, TaskStatus, TaskPriority } from "@/types";
import {
  parseMarkdown,
  serializeMarkdown,
  generateFilename,
  filenameToId,
  todayISO,
  normalizeDate,
} from "./parser";
import {
  isTauri,
  readDir,
  readTextFile,
  writeTextFile,
  mkdir,
  removeFile,
  exists,
  joinPath,
} from "./tauri-fs";
import { SPECIAL_DIRS, PERSONAL_WORKSPACE_ID } from "./constants";
import { getCapturePath, getTasksPath } from "./paths";

// ============================================================================
// MOCK DATA
// ============================================================================

export const mockCaptureTasks: Task[] = [
  {
    id: "2024-01-16-book-dentist",
    projectId: SPECIAL_DIRS.CAPTURE,
    workspaceId: PERSONAL_WORKSPACE_ID,
    filePath: "~/Desk/workspaces/_personal/_capture/tasks/2024-01-16-book-dentist.md",
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

interface TaskFrontmatter {
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
  if (!isTauri()) {
    return [...mockCaptureTasks];
  }

  const capturePath = await getCapturePath();

  if (!(await exists(capturePath))) {
    return [];
  }

  const entries = await readDir(capturePath);
  const tasks: Task[] = [];

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      try {
        const taskPath = await joinPath(capturePath, entry.name);
        const content = await readTextFile(taskPath);
        const { data, content: body } = parseMarkdown<TaskFrontmatter>(content);

        tasks.push({
          id: filenameToId(entry.name),
          projectId: SPECIAL_DIRS.CAPTURE,
          workspaceId: PERSONAL_WORKSPACE_ID,
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

  const task: Task = {
    id,
    projectId: SPECIAL_DIRS.CAPTURE,
    workspaceId: PERSONAL_WORKSPACE_ID,
    filePath: "",
    title: data.title,
    status: "todo",
    priority: data.priority,
    due: data.due,
    created: todayISO(),
    content: data.content || "",
  };

  if (!isTauri()) {
    task.filePath = `~/Desk/workspaces/_personal/_capture/tasks/${filename}`;
    mockCaptureTasks.push(task);
    return task;
  }

  const capturePath = await getCapturePath();
  await mkdir(capturePath);

  const filePath = await joinPath(capturePath, filename);
  task.filePath = filePath;

  const frontmatter: TaskFrontmatter = {
    title: task.title,
    status: task.status,
    priority: task.priority,
    due: task.due,
    created: task.created,
  };

  const fileContent = serializeMarkdown(frontmatter, task.content);
  await writeTextFile(filePath, fileContent);

  return task;
}

/**
 * Update a capture task
 */
export async function updateCaptureTask(
  taskId: string,
  updates: Partial<Pick<Task, "title" | "status" | "priority" | "due" | "content">>
): Promise<Task | null> {
  if (!isTauri()) {
    const index = mockCaptureTasks.findIndex((t) => t.id === taskId);
    if (index === -1) return null;
    mockCaptureTasks[index] = { ...mockCaptureTasks[index], ...updates };
    return mockCaptureTasks[index];
  }

  const tasks = await getCaptureTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const content = await readTextFile(task.filePath);
  const { data, content: body } = parseMarkdown<TaskFrontmatter>(content);

  const updatedData: TaskFrontmatter = {
    ...data,
    ...(updates.title && { title: updates.title }),
    ...(updates.status && { status: updates.status }),
    ...(updates.priority !== undefined && { priority: updates.priority }),
    ...(updates.due !== undefined && { due: updates.due }),
  };

  const updatedContent = updates.content !== undefined ? updates.content : body;
  const fileContent = serializeMarkdown(updatedData, updatedContent);
  await writeTextFile(task.filePath, fileContent);

  return {
    ...task,
    ...updates,
    title: updatedData.title,
    status: updatedData.status,
    priority: updatedData.priority,
    due: updatedData.due,
    content: updatedContent,
  };
}

/**
 * Delete a capture task
 */
export async function deleteCaptureTask(taskId: string): Promise<boolean> {
  if (!isTauri()) {
    const index = mockCaptureTasks.findIndex((t) => t.id === taskId);
    if (index === -1) return false;
    mockCaptureTasks.splice(index, 1);
    return true;
  }

  const tasks = await getCaptureTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return false;

  await removeFile(task.filePath);
  return true;
}

/**
 * Move task from capture to Personal workspace (unassigned)
 * This moves the task to the Personal workspace's _unassigned/tasks/ directory
 */
export async function moveCaptureToPersonal(taskId: string): Promise<Task | null> {
  if (!isTauri()) {
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

  // Read content
  const content = await readTextFile(task.filePath);
  const { data, content: body } = parseMarkdown<TaskFrontmatter>(content);

  // Write to Personal workspace's unassigned tasks
  const unassignedTasksPath = await getTasksPath(PERSONAL_WORKSPACE_ID, SPECIAL_DIRS.UNASSIGNED);
  await mkdir(unassignedTasksPath);

  const filename = task.filePath.split("/").pop()!;
  const newFilePath = await joinPath(unassignedTasksPath, filename);

  const fileContent = serializeMarkdown(data, body);
  await writeTextFile(newFilePath, fileContent);

  // Delete from capture
  await removeFile(task.filePath);

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
  if (!isTauri()) {
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

  // Read content
  const content = await readTextFile(task.filePath);
  const { data, content: body } = parseMarkdown<TaskFrontmatter>(content);

  // Build target path using centralized path builder
  const targetTasksPath = await getTasksPath(workspaceId, projectId);
  await mkdir(targetTasksPath);

  const filename = task.filePath.split("/").pop()!;
  const newFilePath = await joinPath(targetTasksPath, filename);

  const fileContent = serializeMarkdown(data, body);
  await writeTextFile(newFilePath, fileContent);

  // Delete from capture
  await removeFile(task.filePath);

  return {
    ...task,
    projectId,
    workspaceId,
    filePath: newFilePath,
  };
}

