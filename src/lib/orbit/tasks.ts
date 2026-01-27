/**
 * Tasks library - File system operations for tasks
 */
import type { Task, TaskStatus, TaskPriority } from "@/types";
import { parseMarkdown, serializeMarkdown, generateFilename, filenameToId, todayISO, normalizeDate } from "./parser";
import {
  isTauri,
  getOrbitPath,
  readDir,
  readTextFile,
  writeTextFile,
  mkdir,
  removeFile,
  joinPath,
  exists,
} from "./tauri-fs";
import { mockTasks } from "./mock-data";
import { SPECIAL_DIRS, PATH_SEGMENTS, isUnassigned } from "./constants";
import { findItemInAllWorkspaces } from "./search";
import { getFileTreeService } from "./file-cache";
import { useOpenEditorRegistry } from "@/stores/open-editor-registry";
import { publishPathChange, publishDeleted } from "@/stores/editor-event-bus";

interface TaskFrontmatter {
  title: string;
  status: TaskStatus;
  priority?: TaskPriority;
  due?: string;
  created: string;
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

        // Use cached content from file-tree service
        const content = await fileTreeService.getContentByAbsolutePath<string>(
          taskPath,
          (raw) => raw
        );

        if (!content) {
          console.warn(`Failed to read task ${entry.name}: no content`);
          continue;
        }

        const { data, content: body } = parseMarkdown<TaskFrontmatter>(content);

        tasks.push({
          id: filenameToId(entry.name),
          projectId,
          workspaceId,
          filePath: taskPath,
          title: data.title || entry.name,
          status: data.status || "todo",
          priority: data.priority,
          due: data.due ? normalizeDate(data.due) : undefined,
          created: normalizeDate(data.created),
          content: body,
        });
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

  const orbitPath = await getOrbitPath();
  const projectsPath = await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS);

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
  const unassignedPath = await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, SPECIAL_DIRS.UNASSIGNED);
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

  const orbitPath = await getOrbitPath();
  const projectPath = isUnassigned(projectId)
    ? await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, SPECIAL_DIRS.UNASSIGNED)
    : await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS, projectId);

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
    task.filePath = `~/Orbit/workspaces/${data.workspaceId}/projects/${data.projectId}/tasks/${filename}`;
    mockTasks.push(task);
    return task;
  }

  const orbitPath = await getOrbitPath();
  const tasksPath = isUnassigned(data.projectId)
    ? await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, data.workspaceId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.TASKS)
    : await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, data.workspaceId, PATH_SEGMENTS.PROJECTS, data.projectId, PATH_SEGMENTS.TASKS);

  // Ensure tasks directory exists
  await mkdir(tasksPath);

  const filePath = await joinPath(tasksPath, filename);
  task.filePath = filePath;

  // Create task file
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

  // If we have workspaceId and projectId, we can directly locate the file (fast path)
  if (workspaceId && projectId) {
    const orbitPath = await getOrbitPath();
    const tasksPath = isUnassigned(projectId)
      ? await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.TASKS)
      : await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS, projectId, PATH_SEGMENTS.TASKS);

    // Find the task file by ID
    if (await exists(tasksPath)) {
      const entries = await readDir(tasksPath);
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith(".md") && filenameToId(entry.name) === taskId) {
          const filePath = await joinPath(tasksPath, entry.name);
          const content = await readTextFile(filePath);
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
          await writeTextFile(filePath, fileContent);

          return {
            id: taskId,
            projectId,
            workspaceId,
            filePath,
            title: updatedData.title,
            status: updatedData.status,
            priority: updatedData.priority,
            due: updatedData.due,
            created: normalizeDate(data.created),
            content: updatedContent,
          };
        }
      }
    }
    return null;
  }

  // Fallback: search all workspaces (slow path) - uses helper to find item
  const task = await findItemInAllWorkspaces(taskId, getTasks);
  if (!task) return null;

  // Read existing file and update
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

  // If we have workspaceId and projectId, we can directly locate the file (fast path)
  if (workspaceId && projectId) {
    const orbitPath = await getOrbitPath();
    const tasksPath = isUnassigned(projectId)
      ? await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.TASKS)
      : await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS, projectId, PATH_SEGMENTS.TASKS);

    if (await exists(tasksPath)) {
      const entries = await readDir(tasksPath);
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith(".md") && filenameToId(entry.name) === taskId) {
          const filePath = await joinPath(tasksPath, entry.name);

          // Notify editor if file was open
          const registry = useOpenEditorRegistry.getState();
          if (registry.isOpen(filePath)) {
            registry.handlePathDeleted(filePath);
            publishDeleted(filePath);
          }

          await removeFile(filePath);
          return true;
        }
      }
    }
    return false;
  }

  // Fallback: search all workspaces (slow path) - uses helper to find item
  const task = await findItemInAllWorkspaces(taskId, getTasks);
  if (!task) return false;

  // Notify editor if file was open
  const registry = useOpenEditorRegistry.getState();
  if (registry.isOpen(task.filePath)) {
    registry.handlePathDeleted(task.filePath);
    publishDeleted(task.filePath);
  }

  await removeFile(task.filePath);
  return true;
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
    // No move needed
    const tasks = await getTasks(workspaceId);
    return tasks.find((t) => t.id === taskId) || null;
  }

  const orbitPath = await getOrbitPath();

  // Find the source file
  const fromTasksPath = isUnassigned(fromProjectId)
    ? await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.TASKS)
    : await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS, fromProjectId, PATH_SEGMENTS.TASKS);

  if (!(await exists(fromTasksPath))) return null;

  const entries = await readDir(fromTasksPath);
  let sourceFilename: string | null = null;

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md") && filenameToId(entry.name) === taskId) {
      sourceFilename = entry.name;
      break;
    }
  }

  if (!sourceFilename) return null;

  const sourceFilePath = await joinPath(fromTasksPath, sourceFilename);

  // Read the task content
  const content = await readTextFile(sourceFilePath);
  const { data, content: body } = parseMarkdown<TaskFrontmatter>(content);

  // Ensure target directory exists
  const toTasksPath = isUnassigned(toProjectId)
    ? await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.TASKS)
    : await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS, toProjectId, PATH_SEGMENTS.TASKS);

  await mkdir(toTasksPath);

  // Write to new location
  const targetFilePath = await joinPath(toTasksPath, sourceFilename);
  const fileContent = serializeMarkdown(data, body);
  await writeTextFile(targetFilePath, fileContent);

  // Delete original file
  await removeFile(sourceFilePath);

  // Notify editor if file was open
  const registry = useOpenEditorRegistry.getState();
  if (registry.isOpen(sourceFilePath)) {
    registry.handlePathChange(sourceFilePath, targetFilePath);
    publishPathChange(sourceFilePath, targetFilePath);
  }

  return {
    id: taskId,
    projectId: toProjectId,
    workspaceId,
    filePath: targetFilePath,
    title: data.title,
    status: data.status,
    priority: data.priority,
    due: data.due ? normalizeDate(data.due) : undefined,
    created: normalizeDate(data.created),
    content: body,
  };
}
