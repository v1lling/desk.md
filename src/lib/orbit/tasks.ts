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
  areaId: string,
  projectId: string,
  projectPath: string
): Promise<Task[]> {
  const tasksPath = await joinPath(projectPath, "tasks");

  if (!(await exists(tasksPath))) {
    return [];
  }

  const entries = await readDir(tasksPath);
  const tasks: Task[] = [];

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      try {
        const taskPath = await joinPath(tasksPath, entry.name);
        const content = await readTextFile(taskPath);
        const { data, content: body } = parseMarkdown<TaskFrontmatter>(content);

        tasks.push({
          id: filenameToId(entry.name),
          projectId,
          areaId,
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
 * Get all tasks for an area (across all projects)
 */
export async function getTasks(areaId: string): Promise<Task[]> {
  if (!isTauri()) {
    return mockTasks.filter((task) => task.areaId === areaId);
  }

  const orbitPath = await getOrbitPath();
  const projectsPath = await joinPath(orbitPath, "areas", areaId, "projects");

  if (!(await exists(projectsPath))) {
    return [];
  }

  const projectEntries = await readDir(projectsPath);
  const allTasks: Task[] = [];

  for (const entry of projectEntries) {
    if (entry.isDirectory && !entry.name.startsWith(".")) {
      const projectPath = await joinPath(projectsPath, entry.name);
      const projectTasks = await readProjectTasks(areaId, entry.name, projectPath);
      allTasks.push(...projectTasks);
    }
  }

  // Also read inbox tasks
  const inboxPath = await joinPath(orbitPath, "areas", areaId, "_unassigned");
  if (await exists(inboxPath)) {
    const inboxTasks = await readProjectTasks(areaId, "_unassigned", inboxPath);
    allTasks.push(...inboxTasks);
  }

  return allTasks;
}

/**
 * Get tasks filtered by project
 */
export async function getTasksByProject(
  areaId: string,
  projectId: string
): Promise<Task[]> {
  if (!isTauri()) {
    return mockTasks.filter((task) => task.areaId === areaId && task.projectId === projectId);
  }

  const orbitPath = await getOrbitPath();
  const projectPath =
    projectId === "_unassigned"
      ? await joinPath(orbitPath, "areas", areaId, "_unassigned")
      : await joinPath(orbitPath, "areas", areaId, "projects", projectId);

  return readProjectTasks(areaId, projectId, projectPath);
}

/**
 * Get a single task by ID
 */
export async function getTask(
  areaId: string,
  taskId: string
): Promise<Task | null> {
  const tasks = await getTasks(areaId);
  return tasks.find((task) => task.id === taskId) || null;
}

/**
 * Create a new task
 */
export async function createTask(data: {
  areaId: string;
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
    areaId: data.areaId,
    filePath: "",
    title: data.title,
    status: "todo",
    priority: data.priority,
    due: data.due,
    created: todayISO(),
    content: data.content || "",
  };

  if (!isTauri()) {
    task.filePath = `~/Orbit/areas/${data.areaId}/projects/${data.projectId}/tasks/${filename}`;
    mockTasks.push(task);
    return task;
  }

  const orbitPath = await getOrbitPath();
  const tasksPath =
    data.projectId === "_unassigned"
      ? await joinPath(orbitPath, "areas", data.areaId, "_unassigned", "tasks")
      : await joinPath(orbitPath, "areas", data.areaId, "projects", data.projectId, "tasks");

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
  areaId?: string,
  projectId?: string
): Promise<Task | null> {
  if (!isTauri()) {
    const index = mockTasks.findIndex((t) => t.id === taskId);
    if (index === -1) return null;
    mockTasks[index] = { ...mockTasks[index], ...updates };
    return mockTasks[index];
  }

  // If we have areaId and projectId, we can directly locate the file
  if (areaId && projectId) {
    const orbitPath = await getOrbitPath();
    const tasksPath =
      projectId === "_unassigned"
        ? await joinPath(orbitPath, "areas", areaId, "_unassigned", "tasks")
        : await joinPath(orbitPath, "areas", areaId, "projects", projectId, "tasks");

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
            areaId,
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

  // Fallback: search all areas (slow path)
  const orbitPath = await getOrbitPath();
  const areasPath = await joinPath(orbitPath, "areas");
  const areaEntries = await readDir(areasPath);

  for (const areaEntry of areaEntries) {
    if (!areaEntry.isDirectory || areaEntry.name.startsWith(".")) continue;

    const tasks = await getTasks(areaEntry.name);
    const task = tasks.find((t) => t.id === taskId);

    if (task) {
      // Read existing file
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
  }

  return null;
}

/**
 * Delete a task
 */
export async function deleteTask(
  taskId: string,
  areaId?: string,
  projectId?: string
): Promise<boolean> {
  if (!isTauri()) {
    const index = mockTasks.findIndex((t) => t.id === taskId);
    if (index === -1) return false;
    mockTasks.splice(index, 1);
    return true;
  }

  // If we have areaId and projectId, we can directly locate the file
  if (areaId && projectId) {
    const orbitPath = await getOrbitPath();
    const tasksPath =
      projectId === "_unassigned"
        ? await joinPath(orbitPath, "areas", areaId, "_unassigned", "tasks")
        : await joinPath(orbitPath, "areas", areaId, "projects", projectId, "tasks");

    if (await exists(tasksPath)) {
      const entries = await readDir(tasksPath);
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith(".md") && filenameToId(entry.name) === taskId) {
          const filePath = await joinPath(tasksPath, entry.name);
          await removeFile(filePath);
          return true;
        }
      }
    }
    return false;
  }

  // Fallback: search all areas (slow path)
  const orbitPath = await getOrbitPath();
  const areasPath = await joinPath(orbitPath, "areas");
  const areaEntries = await readDir(areasPath);

  for (const areaEntry of areaEntries) {
    if (!areaEntry.isDirectory || areaEntry.name.startsWith(".")) continue;

    const tasks = await getTasks(areaEntry.name);
    const task = tasks.find((t) => t.id === taskId);

    if (task) {
      await removeFile(task.filePath);
      return true;
    }
  }

  return false;
}

/**
 * Move task to different status (for drag-drop)
 */
export async function moveTask(
  taskId: string,
  newStatus: TaskStatus,
  areaId?: string,
  projectId?: string
): Promise<Task | null> {
  return updateTask(taskId, { status: newStatus }, areaId, projectId);
}
