/**
 * Capture library - File system operations for capture/triage inbox
 *
 * Capture is a quick-triage area that lives inside the home workspace:
 * - Quick capture tasks to be triaged to the home workspace or any other workspace
 *
 * File structure:
 * ~/DeskMD/workspaces/{homeWorkspaceId}/
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
  nowISO,
} from "./parser";
import {
  decodeTaskFrontmatter,
  reportFrontmatterDiagnostics,
} from "./frontmatter";
import { joinPath } from "./env";
import { getStorage } from "./storage";
import {
  writeMarkdownFile,
  updateMarkdownFile,
  deleteMarkdownFile,
  moveMarkdownFile,
  allocateUniqueFilePath,
} from "./file-operations";
import { SPECIAL_DIRS } from "./constants";
import { getCapturePath, getTasksPath } from "./paths";
import { getHomeWorkspaceId } from "./workspaces";

// ============================================================================
// FRONTMATTER TYPES
// ============================================================================

interface TaskFrontmatter extends Record<string, unknown> {
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  due?: string;
  created?: string;
  updated?: string;
}

// ============================================================================
// CAPTURE TASKS
// ============================================================================

/**
 * Get all capture tasks (quick capture inbox)
 */
export async function getCaptureTasks(): Promise<Task[]> {
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
        const { data, content: body } = parseMarkdown<Record<string, unknown>>(content);

        const decoded = decodeTaskFrontmatter(data, entry.name, entry.name);
        reportFrontmatterDiagnostics("capture task", taskPath, decoded.diagnostics);
        tasks.push({
          id: filenameToId(entry.name),
          projectId: SPECIAL_DIRS.CAPTURE,
          workspaceId: homeWorkspaceId,
          filePath: taskPath,
          title: decoded.value.title,
          status: decoded.value.status,
          priority: decoded.value.priority,
          due: decoded.value.due,
          created: decoded.value.created,
          updated: decoded.value.updated,
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
  const homeWorkspaceId = await getHomeWorkspaceId();
  const preferredFilename = generateFilename(data.title);
  const capturePath = await getCapturePath();
  const { filename, filePath } = await allocateUniqueFilePath(capturePath, preferredFilename);
  const id = filenameToId(filename);

  const task: Task = {
    id,
    projectId: SPECIAL_DIRS.CAPTURE,
    workspaceId: homeWorkspaceId,
    filePath,
    title: data.title,
    status: "todo",
    priority: data.priority,
    due: data.due,
    created: todayISO(),
    updated: nowISO(),
    content: data.content || "",
  };

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
  const tasks = await getCaptureTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const result = await updateMarkdownFile<Record<string, unknown>>(task.filePath, (data, body) => {
    const updatedData: Record<string, unknown> = {
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
  const metadata = decodeTaskFrontmatter(result.frontmatter, task.title, task.filePath).value;

  return {
    ...task,
    ...updates,
    title: metadata.title,
    status: metadata.status,
    priority: metadata.priority,
    due: metadata.due,
    created: metadata.created,
    updated: metadata.updated,
    content: result.content,
  };
}

/**
 * Delete a capture task
 */
export async function deleteCaptureTask(taskId: string): Promise<boolean> {
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
