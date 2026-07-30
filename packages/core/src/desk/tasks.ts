/**
 * Tasks library - File system operations for tasks
 *
 * Uses file-operations.ts for all file I/O (cache invalidation + registry notification handled there).
 * Uses paths.ts for all path construction.
 */
import type { Task, TaskStatus, TaskPriority, TaskUpdate } from "../types";
import { parseMarkdown, generateFilename, filenameToId, todayISO, nowISO } from "./parser";
import {
  decodeTaskFrontmatter,
  reportFrontmatterDiagnostics,
} from "./frontmatter";
import { joinPath } from "./env";
import { getStorage } from "./storage";
import {
  writeMarkdownFile,
  findFileById,
  findAndUpdateFile,
  findAndDeleteFile,
  moveMarkdownFile,
  readMarkdownFile,
  allocateUniqueFilePath,
} from "./file-operations";
import { SPECIAL_DIRS, PATH_SEGMENTS } from "./constants";
import { getTasksPath, getProjectsPath, getUnassignedPath, getProjectPath } from "./paths";
import { findItemInAllWorkspaces } from "./search";
import { getFileTreeService } from "./file-cache";

interface TaskFrontmatter extends Record<string, unknown> {
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  due?: string;
  created?: string;
  updated?: string;
  author?: string;
}

/**
 * Build a Task object from frontmatter + metadata
 */
function buildTask(
  id: string,
  workspaceId: string,
  projectId: string,
  filePath: string,
  data: Record<string, unknown>,
  body: string,
  filename?: string
): Task {
  const decoded = decodeTaskFrontmatter(
    data,
    filename || id,
    filename ?? filePath,
  );
  reportFrontmatterDiagnostics("task", filePath, decoded.diagnostics);
  const metadata = decoded.value;
  return {
    id,
    projectId,
    workspaceId,
    filePath,
    title: metadata.title,
    status: metadata.status,
    priority: metadata.priority,
    due: metadata.due,
    created: metadata.created,
    updated: metadata.updated,
    author: metadata.author,
    content: body,
  };
}

/**
 * Apply task updates to existing frontmatter
 */
function applyTaskUpdates(
  data: Record<string, unknown>,
  body: string,
  updates: TaskUpdate
): { frontmatter: Record<string, unknown>; content: string } {
  return {
    frontmatter: {
      ...data,
      ...(updates.title && { title: updates.title }),
      ...(updates.status && { status: updates.status }),
      // null clears the field (→ undefined → dropped by serializeMarkdown); undefined leaves it.
      ...(updates.priority !== undefined && { priority: updates.priority ?? undefined }),
      ...(updates.due !== undefined && { due: updates.due ?? undefined }),
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

  if (!(await getStorage().exists(tasksPath))) {
    return [];
  }

  const entries = await getStorage().readDir(tasksPath);
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

        const { data, content: body } = parseMarkdown<Record<string, unknown>>(content);
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
  const projectsPath = await getProjectsPath(workspaceId);

  if (!(await getStorage().exists(projectsPath))) {
    return [];
  }

  const projectEntries = await getStorage().readDir(projectsPath);
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
  if (await getStorage().exists(unassignedPath)) {
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
  templateBody?: string;
  author?: "ai";
}): Promise<Task> {
  const preferredFilename = generateFilename(data.title);
  const tasksPath = await getTasksPath(data.workspaceId, data.projectId);
  const { filename, filePath } = await allocateUniqueFilePath(tasksPath, preferredFilename);

  const id = filenameToId(filename);

  const task: Task = {
    id,
    projectId: data.projectId,
    workspaceId: data.workspaceId,
    filePath,
    title: data.title,
    status: "todo",
    priority: data.priority,
    due: data.due,
    created: todayISO(),
    updated: nowISO(),
    author: data.author,
    content: data.content || data.templateBody || "",
  };

  const frontmatter: TaskFrontmatter = {
    title: task.title,
    status: task.status,
    priority: task.priority,
    due: task.due,
    created: task.created,
    ...(task.author ? { author: task.author } : {}),
  };

  await writeMarkdownFile(filePath, frontmatter, task.content);

  return task;
}

/**
 * Update a task
 */
export async function updateTask(
  taskId: string,
  updates: TaskUpdate,
  workspaceId?: string,
  projectId?: string
): Promise<Task | null> {
  // Helper to perform the update at a known tasks directory
  const updateAtPath = async (tasksPath: string, wsId: string, projId: string): Promise<Task | null> => {
    const result = await findAndUpdateFile<Record<string, unknown>>(
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
  if (fromProjectId === toProjectId) {
    const tasks = await getTasks(workspaceId);
    return tasks.find((t) => t.id === taskId) || null;
  }

  // Find the source file
  const fromTasksPath = await getTasksPath(workspaceId, fromProjectId);
  const sourceFilePath = await findFileById(fromTasksPath, taskId);
  if (!sourceFilePath) return null;

  // Read source content before moving
  const parsed = await readMarkdownFile<Record<string, unknown>>(sourceFilePath);
  if (!parsed) return null;

  // Build target path (same filename, different directory)
  const toTasksPath = await getTasksPath(workspaceId, toProjectId);
  const sourceFilename = sourceFilePath.split("/").pop()!;
  const targetFilePath = await joinPath(toTasksPath, sourceFilename);

  // Move the file (handles mkdir, cache invalidation, registry notification)
  await moveMarkdownFile(sourceFilePath, targetFilePath);

  return buildTask(taskId, workspaceId, toProjectId, targetFilePath, parsed.frontmatter, parsed.content);
}
