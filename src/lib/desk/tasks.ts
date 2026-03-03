/**
 * Tasks library - File system operations for tasks
 *
 * Uses file-operations.ts for all file I/O (cache invalidation + registry notification handled there).
 * Uses paths.ts for all path construction.
 */
import type { Task, TaskStatus, TaskPriority } from "@/types";
import { parseMarkdown, generateFilename, filenameToId, todayISO, normalizeDate } from "./parser";
import { isTauri, readDir, joinPath, exists } from "./tauri-fs";
import {
  writeMarkdownFile,
  findFileById,
  findAndUpdateFile,
  findAndDeleteFile,
  moveMarkdownFile,
  readMarkdownFile,
} from "./file-operations";
import { mockTasks } from "./mock-data";
import { SPECIAL_DIRS, PATH_SEGMENTS } from "./constants";
import { getTasksPath, getProjectsPath, getUnassignedPath, getProjectPath } from "./paths";
import { findItemInAllWorkspaces } from "./search";
import { getFileTreeService } from "./file-cache";

interface TaskFrontmatter extends Record<string, unknown> {
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  due?: string;
  created: string;
}

/**
 * Build a Task object from frontmatter + metadata
 */
function buildTask(
  id: string,
  workspaceId: string,
  projectId: string,
  filePath: string,
  data: TaskFrontmatter,
  body: string,
  filename?: string
): Task {
  return {
    id,
    projectId,
    workspaceId,
    filePath,
    title: data.title || filename || id,
    status: data.status || "todo",
    priority: data.priority,
    due: data.due ? normalizeDate(data.due) : undefined,
    created: normalizeDate(data.created),
    content: body,
  };
}

/**
 * Apply task updates to existing frontmatter
 */
function applyTaskUpdates(
  data: TaskFrontmatter,
  body: string,
  updates: Partial<Pick<Task, "title" | "status" | "priority" | "due" | "content">>
): { frontmatter: TaskFrontmatter; content: string } {
  return {
    frontmatter: {
      ...data,
      ...(updates.title && { title: updates.title }),
      ...(updates.status && { status: updates.status }),
      ...(updates.priority !== undefined && { priority: updates.priority }),
      ...(updates.due !== undefined && { due: updates.due }),
    },
    content: updates.content !== undefined ? updates.content : body,
  };
}

/**
 * Read all tasks from a project's tasks directory
 */
async function readProjectTasks(
  workspaceId: string,
  projectId: string,
  projectPath: string
): Promise<Task[]> {
  const tasksPath = await joinPath(projectPath, PATH_SEGMENTS.TASKS);

  if (!(await exists(tasksPath))) {
    return [];
  }

  const entries = await readDir(tasksPath);
  const tasks: Task[] = [];
  const fileTreeService = getFileTreeService();

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      try {
        const taskPath = await joinPath(tasksPath, entry.name);

        const content = await fileTreeService.getContentByAbsolutePath<string>(
          taskPath,
          (raw) => raw
        );

        if (!content) {
          console.warn(`Failed to read task ${entry.name}: no content`);
          continue;
        }

        const { data, content: body } = parseMarkdown<TaskFrontmatter>(content);
        tasks.push(buildTask(filenameToId(entry.name), workspaceId, projectId, taskPath, data, body, entry.name));
      } catch (e) {
        console.warn(`Failed to read task ${entry.name}:`, e);
      }
    }
  }

  return tasks;
}

/**
 * Get all tasks for a workspace (across all projects)
 */
export async function getTasks(workspaceId: string): Promise<Task[]> {
  if (!isTauri()) {
    return mockTasks.filter((task) => task.workspaceId === workspaceId);
  }

  const projectsPath = await getProjectsPath(workspaceId);

  if (!(await exists(projectsPath))) {
    return [];
  }

  const projectEntries = await readDir(projectsPath);
  const allTasks: Task[] = [];

  for (const entry of projectEntries) {
    if (entry.isDirectory && !entry.name.startsWith(".")) {
      const projectPath = await joinPath(projectsPath, entry.name);
      const projectTasks = await readProjectTasks(workspaceId, entry.name, projectPath);
      allTasks.push(...projectTasks);
    }
  }

  // Also read unassigned tasks
  const unassignedPath = await getUnassignedPath(workspaceId);
  if (await exists(unassignedPath)) {
    const unassignedTasks = await readProjectTasks(workspaceId, SPECIAL_DIRS.UNASSIGNED, unassignedPath);
    allTasks.push(...unassignedTasks);
  }

  return allTasks;
}

/**
 * Get tasks filtered by project
 */
export async function getTasksByProject(
  workspaceId: string,
  projectId: string
): Promise<Task[]> {
  if (!isTauri()) {
    return mockTasks.filter((task) => task.workspaceId === workspaceId && task.projectId === projectId);
  }

  const projectPath = await getProjectPath(workspaceId, projectId);
  return readProjectTasks(workspaceId, projectId, projectPath);
}

/**
 * Get a single task by ID
 */
export async function getTask(
  workspaceId: string,
  taskId: string
): Promise<Task | null> {
  const tasks = await getTasks(workspaceId);
  return tasks.find((task) => task.id === taskId) || null;
}

/**
 * Create a new task
 */
export async function createTask(data: {
  workspaceId: string;
  projectId: string;
  title: string;
  priority?: TaskPriority;
  due?: string;
  content?: string;
}): Promise<Task> {
  const filename = generateFilename(data.title);
  const id = filenameToId(filename);

  const task: Task = {
    id,
    projectId: data.projectId,
    workspaceId: data.workspaceId,
    filePath: "",
    title: data.title,
    status: "todo",
    priority: data.priority,
    due: data.due,
    created: todayISO(),
    content: data.content || "",
  };

  if (!isTauri()) {
    task.filePath = `~/Desk/workspaces/${data.workspaceId}/projects/${data.projectId}/tasks/${filename}`;
    mockTasks.push(task);
    return task;
  }

  const tasksPath = await getTasksPath(data.workspaceId, data.projectId);
  const filePath = await joinPath(tasksPath, filename);
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
 * Update a task
 */
export async function updateTask(
  taskId: string,
  updates: Partial<Pick<Task, "title" | "status" | "priority" | "due" | "content" | "projectId">>,
  workspaceId?: string,
  projectId?: string
): Promise<Task | null> {
  if (!isTauri()) {
    const index = mockTasks.findIndex((t) => t.id === taskId);
    if (index === -1) return null;
    mockTasks[index] = { ...mockTasks[index], ...updates };
    return mockTasks[index];
  }

  // Helper to perform the update at a known tasks directory
  const updateAtPath = async (tasksPath: string, wsId: string, projId: string): Promise<Task | null> => {
    const result = await findAndUpdateFile<TaskFrontmatter>(
      tasksPath,
      taskId,
      (data, body) => applyTaskUpdates(data, body, updates)
    );
    if (!result) return null;
    return buildTask(taskId, wsId, projId, result.filePath, result.frontmatter, result.content);
  };

  // Fast path: directly locate via workspace + project
  if (workspaceId && projectId) {
    const tasksPath = await getTasksPath(workspaceId, projectId);
    return updateAtPath(tasksPath, workspaceId, projectId);
  }

  // Slow path: search all workspaces to find the task
  const task = await findItemInAllWorkspaces(taskId, getTasks);
  if (!task) return null;

  const tasksPath = await getTasksPath(task.workspaceId, task.projectId);
  return updateAtPath(tasksPath, task.workspaceId, task.projectId);
}

/**
 * Delete a task
 */
export async function deleteTask(
  taskId: string,
  workspaceId?: string,
  projectId?: string
): Promise<boolean> {
  if (!isTauri()) {
    const index = mockTasks.findIndex((t) => t.id === taskId);
    if (index === -1) return false;
    mockTasks.splice(index, 1);
    return true;
  }

  // Fast path: directly locate via workspace + project
  if (workspaceId && projectId) {
    const tasksPath = await getTasksPath(workspaceId, projectId);
    const deleted = await findAndDeleteFile(tasksPath, taskId);
    return deleted !== null;
  }

  // Slow path: search all workspaces
  const task = await findItemInAllWorkspaces(taskId, getTasks);
  if (!task) return false;

  const tasksPath = await getTasksPath(task.workspaceId, task.projectId);
  const deleted = await findAndDeleteFile(tasksPath, taskId);
  return deleted !== null;
}

/**
 * Move task to different status (for drag-drop)
 */
export async function moveTask(
  taskId: string,
  newStatus: TaskStatus,
  workspaceId?: string,
  projectId?: string
): Promise<Task | null> {
  return updateTask(taskId, { status: newStatus }, workspaceId, projectId);
}

/**
 * Move task to a different project (physically moves the file)
 */
export async function moveTaskToProject(
  taskId: string,
  workspaceId: string,
  fromProjectId: string,
  toProjectId: string
): Promise<Task | null> {
  if (!isTauri()) {
    const index = mockTasks.findIndex((t) => t.id === taskId && t.workspaceId === workspaceId);
    if (index === -1) return null;
    mockTasks[index] = { ...mockTasks[index], projectId: toProjectId };
    return mockTasks[index];
  }

  if (fromProjectId === toProjectId) {
    const tasks = await getTasks(workspaceId);
    return tasks.find((t) => t.id === taskId) || null;
  }

  // Find the source file
  const fromTasksPath = await getTasksPath(workspaceId, fromProjectId);
  const sourceFilePath = await findFileById(fromTasksPath, taskId);
  if (!sourceFilePath) return null;

  // Read source content before moving
  const parsed = await readMarkdownFile<TaskFrontmatter>(sourceFilePath);
  if (!parsed) return null;

  // Build target path (same filename, different directory)
  const toTasksPath = await getTasksPath(workspaceId, toProjectId);
  const sourceFilename = sourceFilePath.split("/").pop()!;
  const targetFilePath = await joinPath(toTasksPath, sourceFilename);

  // Move the file (handles mkdir, cache invalidation, registry notification)
  await moveMarkdownFile(sourceFilePath, targetFilePath);

  return buildTask(taskId, workspaceId, toProjectId, targetFilePath, parsed.frontmatter, parsed.content);
}
