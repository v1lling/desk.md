/**
 * Notes library - File system operations for notes
 */
import type { Note } from "@/types";
import { parseMarkdown, serializeMarkdown, generateFilename, filenameToId, todayISO, normalizeDate, generatePreview } from "./parser";
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
import { mockNotes } from "./mock-data";
import { SPECIAL_DIRS, PATH_SEGMENTS, isUnassigned } from "./constants";
import { findItemInAllAreas } from "./search";

interface NoteFrontmatter {
  title: string;
  created: string;
}

/**
 * Read all notes from a project's notes directory
 */
async function readProjectNotes(
  areaId: string,
  projectId: string,
  projectPath: string
): Promise<Note[]> {
  const notesPath = await joinPath(projectPath, "notes");

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
          projectId,
          areaId,
          filePath: notePath,
          title: data.title || entry.name,
          created: normalizeDate(data.created),
          content: body,
          preview: generatePreview(body),
        });
      } catch (e) {
        console.warn(`Failed to read note ${entry.name}:`, e);
      }
    }
  }

  // Sort by created date (newest first)
  notes.sort((a, b) => b.created.localeCompare(a.created));

  return notes;
}

/**
 * Get all notes for an area (across all projects)
 */
export async function getNotes(areaId: string): Promise<Note[]> {
  if (!isTauri()) {
    return mockNotes.filter((note) => note.areaId === areaId);
  }

  const orbitPath = await getOrbitPath();
  const projectsPath = await joinPath(orbitPath, "areas", areaId, "projects");

  if (!(await exists(projectsPath))) {
    return [];
  }

  const projectEntries = await readDir(projectsPath);
  const allNotes: Note[] = [];

  for (const entry of projectEntries) {
    if (entry.isDirectory && !entry.name.startsWith(".") && entry.name !== SPECIAL_DIRS.UNASSIGNED) {
      const projectPath = await joinPath(projectsPath, entry.name);
      const projectNotes = await readProjectNotes(areaId, entry.name, projectPath);
      allNotes.push(...projectNotes);
    }
  }

  // Also read unassigned notes
  const unassignedPath = await joinPath(orbitPath, PATH_SEGMENTS.AREAS, areaId, SPECIAL_DIRS.UNASSIGNED);
  if (await exists(unassignedPath)) {
    const unassignedNotes = await readProjectNotes(areaId, SPECIAL_DIRS.UNASSIGNED, unassignedPath);
    allNotes.push(...unassignedNotes);
  }

  // Sort all notes by created date (newest first)
  allNotes.sort((a, b) => b.created.localeCompare(a.created));

  return allNotes;
}

/**
 * Get notes for a specific project
 */
export async function getNotesByProject(
  areaId: string,
  projectId: string
): Promise<Note[]> {
  if (!isTauri()) {
    return mockNotes.filter((note) => note.areaId === areaId && note.projectId === projectId);
  }

  const orbitPath = await getOrbitPath();
  const projectPath = isUnassigned(projectId)
    ? await joinPath(orbitPath, PATH_SEGMENTS.AREAS, areaId, SPECIAL_DIRS.UNASSIGNED)
    : await joinPath(orbitPath, PATH_SEGMENTS.AREAS, areaId, PATH_SEGMENTS.PROJECTS, projectId);

  return readProjectNotes(areaId, projectId, projectPath);
}

/**
 * Get a single note by ID
 */
export async function getNote(
  areaId: string,
  noteId: string
): Promise<Note | null> {
  const notes = await getNotes(areaId);
  return notes.find((note) => note.id === noteId) || null;
}

/**
 * Create a new note
 */
export async function createNote(data: {
  areaId: string;
  projectId: string;
  title: string;
  content?: string;
}): Promise<Note> {
  const filename = generateFilename(data.title);
  const id = filenameToId(filename);
  const content = data.content || `# ${data.title}\n\n`;

  const note: Note = {
    id,
    projectId: data.projectId,
    areaId: data.areaId,
    filePath: "",
    title: data.title,
    created: todayISO(),
    content,
    preview: generatePreview(content),
  };

  if (!isTauri()) {
    note.filePath = `~/Orbit/areas/${data.areaId}/projects/${data.projectId}/notes/${filename}`;
    mockNotes.unshift(note);
    return note;
  }

  const orbitPath = await getOrbitPath();
  const notesPath = isUnassigned(data.projectId)
    ? await joinPath(orbitPath, PATH_SEGMENTS.AREAS, data.areaId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.NOTES)
    : await joinPath(orbitPath, PATH_SEGMENTS.AREAS, data.areaId, PATH_SEGMENTS.PROJECTS, data.projectId, PATH_SEGMENTS.NOTES);

  // Ensure notes directory exists
  await mkdir(notesPath);

  const filePath = await joinPath(notesPath, filename);
  note.filePath = filePath;

  // Create note file
  const frontmatter: NoteFrontmatter = {
    title: note.title,
    created: note.created,
  };

  const fileContent = serializeMarkdown(frontmatter, note.content);
  await writeTextFile(filePath, fileContent);

  return note;
}

/**
 * Update a note
 */
export async function updateNote(
  noteId: string,
  updates: Partial<Pick<Note, "title" | "content">>,
  areaId?: string,
  projectId?: string
): Promise<Note | null> {
  if (!isTauri()) {
    const index = mockNotes.findIndex((n) => n.id === noteId);
    if (index === -1) return null;

    const updatedFields: Partial<Note> = { ...updates };
    if (updates.content) {
      updatedFields.preview = generatePreview(updates.content);
    }

    mockNotes[index] = { ...mockNotes[index], ...updatedFields };
    return mockNotes[index];
  }

  // If we have areaId and projectId, we can directly locate the file (fast path)
  if (areaId && projectId) {
    const orbitPath = await getOrbitPath();
    const notesPath = isUnassigned(projectId)
      ? await joinPath(orbitPath, PATH_SEGMENTS.AREAS, areaId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.NOTES)
      : await joinPath(orbitPath, PATH_SEGMENTS.AREAS, areaId, PATH_SEGMENTS.PROJECTS, projectId, PATH_SEGMENTS.NOTES);

    if (await exists(notesPath)) {
      const entries = await readDir(notesPath);
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith(".md") && filenameToId(entry.name) === noteId) {
          const filePath = await joinPath(notesPath, entry.name);
          const content = await readTextFile(filePath);
          const { data, content: body } = parseMarkdown<NoteFrontmatter>(content);

          const updatedData: NoteFrontmatter = {
            ...data,
            ...(updates.title && { title: updates.title }),
          };

          const updatedContent = updates.content !== undefined ? updates.content : body;
          const fileContent = serializeMarkdown(updatedData, updatedContent);
          await writeTextFile(filePath, fileContent);

          return {
            id: noteId,
            projectId,
            areaId,
            filePath,
            title: updatedData.title,
            created: normalizeDate(data.created),
            content: updatedContent,
            preview: generatePreview(updatedContent),
          };
        }
      }
    }
    return null;
  }

  // Fallback: search all areas (slow path) - uses helper to find item
  const note = await findItemInAllAreas(noteId, getNotes);
  if (!note) return null;

  // Read existing file and update
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
 * Delete a note
 */
export async function deleteNote(
  noteId: string,
  areaId?: string,
  projectId?: string
): Promise<boolean> {
  if (!isTauri()) {
    const index = mockNotes.findIndex((n) => n.id === noteId);
    if (index === -1) return false;
    mockNotes.splice(index, 1);
    return true;
  }

  // If we have areaId and projectId, we can directly locate the file (fast path)
  if (areaId && projectId) {
    const orbitPath = await getOrbitPath();
    const notesPath = isUnassigned(projectId)
      ? await joinPath(orbitPath, PATH_SEGMENTS.AREAS, areaId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.NOTES)
      : await joinPath(orbitPath, PATH_SEGMENTS.AREAS, areaId, PATH_SEGMENTS.PROJECTS, projectId, PATH_SEGMENTS.NOTES);

    if (await exists(notesPath)) {
      const entries = await readDir(notesPath);
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith(".md") && filenameToId(entry.name) === noteId) {
          const filePath = await joinPath(notesPath, entry.name);
          await removeFile(filePath);
          return true;
        }
      }
    }
    return false;
  }

  // Fallback: search all areas (slow path) - uses helper to find item
  const note = await findItemInAllAreas(noteId, getNotes);
  if (!note) return false;

  await removeFile(note.filePath);
  return true;
}

/**
 * Move note to a different project (physically moves the file)
 */
export async function moveNoteToProject(
  noteId: string,
  areaId: string,
  fromProjectId: string,
  toProjectId: string
): Promise<Note | null> {
  if (!isTauri()) {
    const index = mockNotes.findIndex((n) => n.id === noteId && n.areaId === areaId);
    if (index === -1) return null;
    mockNotes[index] = { ...mockNotes[index], projectId: toProjectId };
    return mockNotes[index];
  }

  if (fromProjectId === toProjectId) {
    // No move needed
    const notes = await getNotes(areaId);
    return notes.find((n) => n.id === noteId) || null;
  }

  const orbitPath = await getOrbitPath();

  // Find the source file
  const fromNotesPath = isUnassigned(fromProjectId)
    ? await joinPath(orbitPath, PATH_SEGMENTS.AREAS, areaId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.NOTES)
    : await joinPath(orbitPath, PATH_SEGMENTS.AREAS, areaId, PATH_SEGMENTS.PROJECTS, fromProjectId, PATH_SEGMENTS.NOTES);

  if (!(await exists(fromNotesPath))) return null;

  const entries = await readDir(fromNotesPath);
  let sourceFilename: string | null = null;

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md") && filenameToId(entry.name) === noteId) {
      sourceFilename = entry.name;
      break;
    }
  }

  if (!sourceFilename) return null;

  const sourceFilePath = await joinPath(fromNotesPath, sourceFilename);

  // Read the note content
  const content = await readTextFile(sourceFilePath);
  const { data, content: body } = parseMarkdown<NoteFrontmatter>(content);

  // Ensure target directory exists
  const toNotesPath = isUnassigned(toProjectId)
    ? await joinPath(orbitPath, PATH_SEGMENTS.AREAS, areaId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.NOTES)
    : await joinPath(orbitPath, PATH_SEGMENTS.AREAS, areaId, PATH_SEGMENTS.PROJECTS, toProjectId, PATH_SEGMENTS.NOTES);

  await mkdir(toNotesPath);

  // Write to new location
  const targetFilePath = await joinPath(toNotesPath, sourceFilename);
  const fileContent = serializeMarkdown(data, body);
  await writeTextFile(targetFilePath, fileContent);

  // Delete original file
  await removeFile(sourceFilePath);

  return {
    id: noteId,
    projectId: toProjectId,
    areaId,
    filePath: targetFilePath,
    title: data.title,
    created: normalizeDate(data.created),
    content: body,
    preview: generatePreview(body),
  };
}
