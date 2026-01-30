/**
 * Personal Space library - File system operations for personal items
 *
 * Personal space is a special area outside of workspaces for:
 * - Capture: Quick capture tasks to be triaged later
 * - Tasks: Personal tasks not tied to any workspace
 * - Docs: Personal docs (handled by docs.ts)
 *
 * File structure:
 * ~/Desk/personal/
 *   ├── capture/tasks/*.md   # Quick capture
 *   ├── tasks/*.md           # Personal tasks
 *   ├── docs/                 # Personal docs (see docs.ts)
 *   └── .view.json           # UI state
 */

import type { Task, TaskStatus, TaskPriority } from "@/types";
import {
  parseMarkdown,
  serializeMarkdown,
  generateFilename,
  filenameToId,
  todayISO,
  normalizeDate,
  generatePreview,
} from "./parser";
import {
  isTauri,
  getDeskPath,
  readDir,
  readTextFile,
  writeTextFile,
  mkdir,
  removeFile,
  joinPath,
  exists,
} from "./tauri-fs";
import { PATH_SEGMENTS, PERSONAL_SPACE_ID } from "./constants";

// ============================================================================
// MOCK DATA
// ============================================================================

export const mockPersonalTasks: Task[] = [
  {
    id: "2024-01-16-book-dentist",
    projectId: "_capture",
    workspaceId: PERSONAL_SPACE_ID,
    filePath: "~/Desk/personal/capture/tasks/2024-01-16-book-dentist.md",
    title: "Book dentist appointment",
    status: "todo",
    priority: "low",
    created: "2024-01-16",
    content: "Remember to book the 6-month checkup",
  },
  {
    id: "2024-01-15-grocery",
    projectId: "_tasks",
    workspaceId: PERSONAL_SPACE_ID,
    filePath: "~/Desk/personal/tasks/2024-01-15-grocery.md",
    title: "Weekly grocery shopping",
    status: "doing",
    created: "2024-01-15",
    content: "- Milk\n- Bread\n- Eggs\n- Vegetables",
  },
  {
    id: "2024-01-14-gym",
    projectId: "_tasks",
    workspaceId: PERSONAL_SPACE_ID,
    filePath: "~/Desk/personal/tasks/2024-01-14-gym.md",
    title: "Renew gym membership",
    status: "done",
    created: "2024-01-14",
    content: "Annual membership expires end of month",
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
// HELPER: Get personal base path
// ============================================================================

async function getPersonalPath(): Promise<string> {
  const deskPath = await getDeskPath();
  return joinPath(deskPath, PATH_SEGMENTS.PERSONAL);
}

// ============================================================================
// TASKS
// ============================================================================

/**
 * Read tasks from a specific personal directory (capture or tasks)
 */
async function readPersonalTasksFromDir(
  dirPath: string,
  projectId: string
): Promise<Task[]> {
  const tasksPath = await joinPath(dirPath, PATH_SEGMENTS.TASKS);

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
          workspaceId: PERSONAL_SPACE_ID,
          filePath: taskPath,
          title: data.title || entry.name,
          status: data.status || "todo",
          priority: data.priority,
          due: data.due ? normalizeDate(data.due) : undefined,
          created: normalizeDate(data.created),
          content: body,
        });
      } catch (e) {
        console.warn(`Failed to read personal task ${entry.name}:`, e);
      }
    }
  }

  return tasks;
}

/**
 * Get all capture tasks (quick capture)
 */
export async function getCaptureTasks(): Promise<Task[]> {
  if (!isTauri()) {
    return mockPersonalTasks.filter((t) => t.projectId === "_capture");
  }

  const personalPath = await getPersonalPath();
  const capturePath = await joinPath(personalPath, PATH_SEGMENTS.CAPTURE);
  return readPersonalTasksFromDir(capturePath, "_capture");
}

/**
 * Get all personal tasks (not capture)
 */
export async function getPersonalTasks(): Promise<Task[]> {
  if (!isTauri()) {
    return mockPersonalTasks.filter((t) => t.projectId === "_tasks");
  }

  const personalPath = await getPersonalPath();
  return readPersonalTasksFromDir(personalPath, "_tasks");
}

/**
 * Get all personal space tasks (capture + personal)
 */
export async function getAllPersonalTasks(): Promise<Task[]> {
  if (!isTauri()) {
    return [...mockPersonalTasks];
  }

  const captureTasks = await getCaptureTasks();
  const personalTasks = await getPersonalTasks();
  return [...captureTasks, ...personalTasks];
}

/**
 * Get a single personal task by ID (searches both capture and tasks)
 */
export async function getPersonalTask(taskId: string): Promise<Task | null> {
  const allTasks = await getAllPersonalTasks();
  return allTasks.find((t) => t.id === taskId) || null;
}

/**
 * Create a personal task
 */
export async function createPersonalTask(data: {
  title: string;
  isCapture?: boolean; // true = capture, false = personal tasks
  priority?: TaskPriority;
  due?: string;
  content?: string;
}): Promise<Task> {
  const filename = generateFilename(data.title);
  const id = filenameToId(filename);
  const projectId = data.isCapture ? "_capture" : "_tasks";

  const task: Task = {
    id,
    projectId,
    workspaceId: PERSONAL_SPACE_ID,
    filePath: "",
    title: data.title,
    status: "todo",
    priority: data.priority,
    due: data.due,
    created: todayISO(),
    content: data.content || "",
  };

  if (!isTauri()) {
    const dir = data.isCapture ? `${PATH_SEGMENTS.CAPTURE}/${PATH_SEGMENTS.TASKS}` : PATH_SEGMENTS.TASKS;
    task.filePath = `~/Desk/${PATH_SEGMENTS.PERSONAL}/${dir}/${filename}`;
    mockPersonalTasks.push(task);
    return task;
  }

  const personalPath = await getPersonalPath();
  const tasksPath = data.isCapture
    ? await joinPath(personalPath, PATH_SEGMENTS.CAPTURE, PATH_SEGMENTS.TASKS)
    : await joinPath(personalPath, PATH_SEGMENTS.TASKS);

  await mkdir(tasksPath);

  const filePath = await joinPath(tasksPath, filename);
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
 * Update a personal task
 */
export async function updatePersonalTask(
  taskId: string,
  updates: Partial<Pick<Task, "title" | "status" | "priority" | "due" | "content">>
): Promise<Task | null> {
  if (!isTauri()) {
    const index = mockPersonalTasks.findIndex((t) => t.id === taskId);
    if (index === -1) return null;
    mockPersonalTasks[index] = { ...mockPersonalTasks[index], ...updates };
    return mockPersonalTasks[index];
  }

  // Find the task in capture or tasks
  const allTasks = await getAllPersonalTasks();
  const task = allTasks.find((t) => t.id === taskId);
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
 * Delete a personal task
 */
export async function deletePersonalTask(taskId: string): Promise<boolean> {
  if (!isTauri()) {
    const index = mockPersonalTasks.findIndex((t) => t.id === taskId);
    if (index === -1) return false;
    mockPersonalTasks.splice(index, 1);
    return true;
  }

  const allTasks = await getAllPersonalTasks();
  const task = allTasks.find((t) => t.id === taskId);
  if (!task) return false;

  await removeFile(task.filePath);
  return true;
}

/**
 * Move task from capture to personal tasks (triage)
 */
export async function moveFromCapture(taskId: string): Promise<Task | null> {
  if (!isTauri()) {
    const index = mockPersonalTasks.findIndex((t) => t.id === taskId);
    if (index === -1) return null;
    mockPersonalTasks[index] = { ...mockPersonalTasks[index], projectId: "_tasks" };
    return mockPersonalTasks[index];
  }

  const captureTasks = await getCaptureTasks();
  const task = captureTasks.find((t) => t.id === taskId);
  if (!task) return null;

  // Read content
  const content = await readTextFile(task.filePath);
  const { data, content: body } = parseMarkdown<TaskFrontmatter>(content);

  // Write to new location
  const personalPath = await getPersonalPath();
  const tasksPath = await joinPath(personalPath, PATH_SEGMENTS.TASKS);
  await mkdir(tasksPath);

  const filename = task.filePath.split("/").pop()!;
  const newFilePath = await joinPath(tasksPath, filename);

  const fileContent = serializeMarkdown(data, body);
  await writeTextFile(newFilePath, fileContent);

  // Delete from capture
  await removeFile(task.filePath);

  return {
    ...task,
    projectId: "_tasks",
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
  // Import here to avoid circular deps
  const { SPECIAL_DIRS, isUnassigned } = await import("./constants");

  if (!isTauri()) {
    const index = mockPersonalTasks.findIndex((t) => t.id === taskId);
    if (index === -1) return null;

    // Remove from mock personal tasks and return as workspace task
    const [task] = mockPersonalTasks.splice(index, 1);
    return {
      ...task,
      projectId,
      workspaceId,
    };
  }

  const captureTasks = await getCaptureTasks();
  const task = captureTasks.find((t) => t.id === taskId);
  if (!task) return null;

  // Read content
  const content = await readTextFile(task.filePath);
  const { data, content: body } = parseMarkdown<TaskFrontmatter>(content);

  // Build target path
  const deskPath = await getDeskPath();
  const tasksPath = isUnassigned(projectId)
    ? await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, workspaceId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.TASKS)
    : await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS, projectId, PATH_SEGMENTS.TASKS);

  await mkdir(tasksPath);

  const filename = task.filePath.split("/").pop()!;
  const newFilePath = await joinPath(tasksPath, filename);

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


// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the personal directory structure
 */
export async function initPersonalDirectory(): Promise<void> {
  if (!isTauri()) return;

  const personalPath = await getPersonalPath();

  // Create directory structure
  await mkdir(personalPath);
  await mkdir(await joinPath(personalPath, PATH_SEGMENTS.CAPTURE));
  await mkdir(await joinPath(personalPath, PATH_SEGMENTS.CAPTURE, PATH_SEGMENTS.TASKS));
  await mkdir(await joinPath(personalPath, PATH_SEGMENTS.TASKS));
  await mkdir(await joinPath(personalPath, PATH_SEGMENTS.DOCS));
}
