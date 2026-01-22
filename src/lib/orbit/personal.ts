/**
 * Personal Space library - File system operations for personal items
 *
 * Personal space is a special area outside of workspaces for:
 * - Inbox: Quick capture tasks to be triaged later
 * - Tasks: Personal tasks not tied to any workspace
 * - Notes: Personal notes and scratchpad
 *
 * File structure:
 * ~/Orbit/personal/
 *   ├── inbox/tasks/*.md    # Quick capture
 *   ├── tasks/*.md          # Personal tasks
 *   ├── notes/*.md          # Personal notes
 *   └── .view.json          # UI state
 */

import type { Task, Note, TaskStatus, TaskPriority } from "@/types";
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
  getOrbitPath,
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
    projectId: "_inbox",
    workspaceId: PERSONAL_SPACE_ID,
    filePath: "~/Orbit/personal/inbox/tasks/2024-01-16-book-dentist.md",
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
    filePath: "~/Orbit/personal/tasks/2024-01-15-grocery.md",
    title: "Weekly grocery shopping",
    status: "doing",
    created: "2024-01-15",
    content: "- Milk\n- Bread\n- Eggs\n- Vegetables",
  },
  {
    id: "2024-01-14-gym",
    projectId: "_tasks",
    workspaceId: PERSONAL_SPACE_ID,
    filePath: "~/Orbit/personal/tasks/2024-01-14-gym.md",
    title: "Renew gym membership",
    status: "done",
    created: "2024-01-14",
    content: "Annual membership expires end of month",
  },
];

export const mockPersonalNotes: Note[] = [
  {
    id: "2024-01-16-ideas",
    projectId: "_notes",
    workspaceId: PERSONAL_SPACE_ID,
    filePath: "~/Orbit/personal/notes/2024-01-16-ideas.md",
    title: "Random Ideas",
    created: "2024-01-16",
    content:
      "# Random Ideas\n\n- App idea: Plant watering reminder\n- Blog post: How I organize my work\n- Side project: CLI tool for markdown notes",
    preview: "Random Ideas - App idea: Plant watering reminder...",
  },
  {
    id: "2024-01-10-reading-list",
    projectId: "_notes",
    workspaceId: PERSONAL_SPACE_ID,
    filePath: "~/Orbit/personal/notes/2024-01-10-reading-list.md",
    title: "Reading List 2024",
    created: "2024-01-10",
    content:
      "# Reading List 2024\n\n## Currently Reading\n- The Pragmatic Programmer\n\n## To Read\n- Clean Code\n- Domain-Driven Design\n- Designing Data-Intensive Applications",
    preview: "Reading List 2024 - Currently Reading: The Pragmatic Programmer...",
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

interface NoteFrontmatter {
  title: string;
  created: string;
}

// ============================================================================
// HELPER: Get personal base path
// ============================================================================

async function getPersonalPath(): Promise<string> {
  const orbitPath = await getOrbitPath();
  return joinPath(orbitPath, PATH_SEGMENTS.PERSONAL);
}

// ============================================================================
// TASKS
// ============================================================================

/**
 * Read tasks from a specific personal directory (inbox or tasks)
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
 * Get all personal inbox tasks (quick capture)
 */
export async function getInboxTasks(): Promise<Task[]> {
  if (!isTauri()) {
    return mockPersonalTasks.filter((t) => t.projectId === "_inbox");
  }

  const personalPath = await getPersonalPath();
  const inboxPath = await joinPath(personalPath, PATH_SEGMENTS.INBOX);
  return readPersonalTasksFromDir(inboxPath, "_inbox");
}

/**
 * Get all personal tasks (not inbox)
 */
export async function getPersonalTasks(): Promise<Task[]> {
  if (!isTauri()) {
    return mockPersonalTasks.filter((t) => t.projectId === "_tasks");
  }

  const personalPath = await getPersonalPath();
  return readPersonalTasksFromDir(personalPath, "_tasks");
}

/**
 * Get all personal space tasks (inbox + personal)
 */
export async function getAllPersonalTasks(): Promise<Task[]> {
  if (!isTauri()) {
    return [...mockPersonalTasks];
  }

  const inboxTasks = await getInboxTasks();
  const personalTasks = await getPersonalTasks();
  return [...inboxTasks, ...personalTasks];
}

/**
 * Create a personal task
 */
export async function createPersonalTask(data: {
  title: string;
  isInbox?: boolean; // true = inbox, false = personal tasks
  priority?: TaskPriority;
  due?: string;
  content?: string;
}): Promise<Task> {
  const filename = generateFilename(data.title);
  const id = filenameToId(filename);
  const projectId = data.isInbox ? "_inbox" : "_tasks";

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
    const dir = data.isInbox ? `${PATH_SEGMENTS.INBOX}/${PATH_SEGMENTS.TASKS}` : PATH_SEGMENTS.TASKS;
    task.filePath = `~/Orbit/${PATH_SEGMENTS.PERSONAL}/${dir}/${filename}`;
    mockPersonalTasks.push(task);
    return task;
  }

  const personalPath = await getPersonalPath();
  const tasksPath = data.isInbox
    ? await joinPath(personalPath, PATH_SEGMENTS.INBOX, PATH_SEGMENTS.TASKS)
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

  // Find the task in inbox or tasks
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
 * Move task from inbox to personal tasks (triage)
 */
export async function moveFromInbox(taskId: string): Promise<Task | null> {
  if (!isTauri()) {
    const index = mockPersonalTasks.findIndex((t) => t.id === taskId);
    if (index === -1) return null;
    mockPersonalTasks[index] = { ...mockPersonalTasks[index], projectId: "_tasks" };
    return mockPersonalTasks[index];
  }

  const inboxTasks = await getInboxTasks();
  const task = inboxTasks.find((t) => t.id === taskId);
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

  // Delete from inbox
  await removeFile(task.filePath);

  return {
    ...task,
    projectId: "_tasks",
    filePath: newFilePath,
  };
}

/**
 * Move task from inbox to a workspace project
 */
export async function moveFromInboxToWorkspace(
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

  const inboxTasks = await getInboxTasks();
  const task = inboxTasks.find((t) => t.id === taskId);
  if (!task) return null;

  // Read content
  const content = await readTextFile(task.filePath);
  const { data, content: body } = parseMarkdown<TaskFrontmatter>(content);

  // Build target path
  const orbitPath = await getOrbitPath();
  const tasksPath = isUnassigned(projectId)
    ? await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.TASKS)
    : await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS, projectId, PATH_SEGMENTS.TASKS);

  await mkdir(tasksPath);

  const filename = task.filePath.split("/").pop()!;
  const newFilePath = await joinPath(tasksPath, filename);

  const fileContent = serializeMarkdown(data, body);
  await writeTextFile(newFilePath, fileContent);

  // Delete from inbox
  await removeFile(task.filePath);

  return {
    ...task,
    projectId,
    workspaceId,
    filePath: newFilePath,
  };
}

// ============================================================================
// NOTES
// ============================================================================

/**
 * Get all personal notes
 */
export async function getPersonalNotes(): Promise<Note[]> {
  if (!isTauri()) {
    return [...mockPersonalNotes];
  }

  const personalPath = await getPersonalPath();
  const notesPath = await joinPath(personalPath, PATH_SEGMENTS.DOCS);

  if (!(await exists(notesPath))) {
    return [];
  }

  const entries = await readDir(notesPath);
  const notes: Note[] = [];

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      try {
        const notePath = await joinPath(notesPath, entry.name);
        const content = await readTextFile(notePath);
        const { data, content: body } = parseMarkdown<NoteFrontmatter>(content);

        notes.push({
          id: filenameToId(entry.name),
          projectId: "_notes",
          workspaceId: PERSONAL_SPACE_ID,
          filePath: notePath,
          title: data.title || entry.name,
          created: normalizeDate(data.created),
          content: body,
          preview: generatePreview(body),
        });
      } catch (e) {
        console.warn(`Failed to read personal note ${entry.name}:`, e);
      }
    }
  }

  // Sort by created date (newest first)
  notes.sort((a, b) => b.created.localeCompare(a.created));

  return notes;
}

/**
 * Get a single personal note by ID
 */
export async function getPersonalNote(noteId: string): Promise<Note | null> {
  const notes = await getPersonalNotes();
  return notes.find((n) => n.id === noteId) || null;
}

/**
 * Create a personal note
 */
export async function createPersonalNote(data: {
  title: string;
  content?: string;
}): Promise<Note> {
  const filename = generateFilename(data.title);
  const id = filenameToId(filename);
  const content = data.content || `# ${data.title}\n\n`;

  const note: Note = {
    id,
    projectId: "_notes",
    workspaceId: PERSONAL_SPACE_ID,
    filePath: "",
    title: data.title,
    created: todayISO(),
    content,
    preview: generatePreview(content),
  };

  if (!isTauri()) {
    note.filePath = `~/Orbit/personal/notes/${filename}`;
    mockPersonalNotes.unshift(note);
    return note;
  }

  const personalPath = await getPersonalPath();
  const notesPath = await joinPath(personalPath, PATH_SEGMENTS.DOCS);
  await mkdir(notesPath);

  const filePath = await joinPath(notesPath, filename);
  note.filePath = filePath;

  const frontmatter: NoteFrontmatter = {
    title: note.title,
    created: note.created,
  };

  const fileContent = serializeMarkdown(frontmatter, note.content);
  await writeTextFile(filePath, fileContent);

  return note;
}

/**
 * Update a personal note
 */
export async function updatePersonalNote(
  noteId: string,
  updates: Partial<Pick<Note, "title" | "content">>
): Promise<Note | null> {
  if (!isTauri()) {
    const index = mockPersonalNotes.findIndex((n) => n.id === noteId);
    if (index === -1) return null;

    const updatedFields: Partial<Note> = { ...updates };
    if (updates.content) {
      updatedFields.preview = generatePreview(updates.content);
    }

    mockPersonalNotes[index] = { ...mockPersonalNotes[index], ...updatedFields };
    return mockPersonalNotes[index];
  }

  const note = await getPersonalNote(noteId);
  if (!note) return null;

  const content = await readTextFile(note.filePath);
  const { data } = parseMarkdown<NoteFrontmatter>(content);

  const updatedData: NoteFrontmatter = {
    ...data,
    ...(updates.title && { title: updates.title }),
  };

  const updatedContent = updates.content !== undefined ? updates.content : note.content;
  const fileContent = serializeMarkdown(updatedData, updatedContent);
  await writeTextFile(note.filePath, fileContent);

  return {
    ...note,
    title: updatedData.title,
    content: updatedContent,
    preview: generatePreview(updatedContent),
  };
}

/**
 * Delete a personal note
 */
export async function deletePersonalNote(noteId: string): Promise<boolean> {
  if (!isTauri()) {
    const index = mockPersonalNotes.findIndex((n) => n.id === noteId);
    if (index === -1) return false;
    mockPersonalNotes.splice(index, 1);
    return true;
  }

  const note = await getPersonalNote(noteId);
  if (!note) return false;

  await removeFile(note.filePath);
  return true;
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
  await mkdir(await joinPath(personalPath, PATH_SEGMENTS.INBOX));
  await mkdir(await joinPath(personalPath, PATH_SEGMENTS.INBOX, PATH_SEGMENTS.TASKS));
  await mkdir(await joinPath(personalPath, PATH_SEGMENTS.TASKS));
  await mkdir(await joinPath(personalPath, PATH_SEGMENTS.DOCS));
}
