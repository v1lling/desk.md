/**
 * Notes library - File system operations for notes
 */
import type { Note } from "@/types";
import { parseMarkdown, serializeMarkdown, generateFilename, filenameToId, todayISO } from "./parser";
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

// Mock notes for browser development
let mockNotes: Note[] = [
  {
    id: "2024-01-15-meeting-zb-winterthur",
    projectId: "slskey",
    areaId: "slsp",
    filePath: "~/Orbit/areas/slsp/projects/slskey/notes/2024-01-15-meeting-zb-winterthur.md",
    title: "Meeting with ZB Winterthur",
    created: "2024-01-15",
    content: "# Meeting with ZB Winterthur\n\n**Date:** 2024-01-15\n**Attendees:** John, Sarah, Mike\n\n## Agenda\n- Discuss webhook integration\n- Review timeline\n- Address security concerns\n\n## Notes\nThey want to go live by end of February. Need to prioritize the webhook setup.\n\n## Action Items\n- [ ] Send API documentation\n- [ ] Schedule follow-up call\n- [ ] Prepare security audit report",
    preview: "Meeting with ZB Winterthur - Date: 2024-01-15, Attendees: John, Sarah, Mike...",
  },
  {
    id: "2024-01-12-api-changes",
    projectId: "slskey",
    areaId: "slsp",
    filePath: "~/Orbit/areas/slsp/projects/slskey/notes/2024-01-12-api-changes.md",
    title: "API v2 Changes Summary",
    created: "2024-01-12",
    content: "# API v2 Changes Summary\n\n## Breaking Changes\n- Authentication endpoint moved to `/auth/v2`\n- Response format changed to JSON:API spec\n- Rate limiting now 100 req/min\n\n## New Features\n- Batch operations support\n- Webhook callbacks\n- GraphQL endpoint (beta)\n\n## Migration Guide\nSee docs at `/docs/migration-v2`",
    preview: "API v2 Changes Summary - Breaking Changes: Authentication endpoint moved...",
  },
  {
    id: "2024-01-10-alma-kickoff",
    projectId: "alma-migration",
    areaId: "slsp",
    filePath: "~/Orbit/areas/slsp/projects/alma-migration/notes/2024-01-10-alma-kickoff.md",
    title: "Alma Migration Kickoff",
    created: "2024-01-10",
    content: "# Alma Migration Kickoff\n\n## Project Overview\nMigrating from legacy system to Ex Libris Alma.\n\n## Timeline\n- Phase 1: Data mapping (Jan-Feb)\n- Phase 2: Test migration (Mar)\n- Phase 3: Production migration (Apr)\n\n## Team\n- Lead: Maria\n- Technical: Alex, Chris\n- Support: Lisa",
    preview: "Alma Migration Kickoff - Project Overview: Migrating from legacy system to Ex Libris Alma...",
  },
];

interface NoteFrontmatter {
  title: string;
  created: string;
}

/**
 * Generate preview text from content
 */
function generatePreview(content: string): string {
  return content.slice(0, 100).replace(/[#\n]/g, " ").trim() + "...";
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
          created: data.created || todayISO(),
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
    if (entry.isDirectory && !entry.name.startsWith(".") && entry.name !== "_inbox") {
      const projectPath = await joinPath(projectsPath, entry.name);
      const projectNotes = await readProjectNotes(areaId, entry.name, projectPath);
      allNotes.push(...projectNotes);
    }
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
  const projectPath = await joinPath(orbitPath, "areas", areaId, "projects", projectId);

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
  const notesPath = await joinPath(orbitPath, "areas", data.areaId, "projects", data.projectId, "notes");

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

  // If we have areaId and projectId, we can directly locate the file
  if (areaId && projectId) {
    const orbitPath = await getOrbitPath();
    const notesPath = await joinPath(orbitPath, "areas", areaId, "projects", projectId, "notes");

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
            created: data.created || todayISO(),
            content: updatedContent,
            preview: generatePreview(updatedContent),
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

    const notes = await getNotes(areaEntry.name);
    const note = notes.find((n) => n.id === noteId);

    if (note) {
      // Read existing file
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
  }

  return null;
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

  // If we have areaId and projectId, we can directly locate the file
  if (areaId && projectId) {
    const orbitPath = await getOrbitPath();
    const notesPath = await joinPath(orbitPath, "areas", areaId, "projects", projectId, "notes");

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

  // Fallback: search all areas (slow path)
  const orbitPath = await getOrbitPath();
  const areasPath = await joinPath(orbitPath, "areas");
  const areaEntries = await readDir(areasPath);

  for (const areaEntry of areaEntries) {
    if (!areaEntry.isDirectory || areaEntry.name.startsWith(".")) continue;

    const notes = await getNotes(areaEntry.name);
    const note = notes.find((n) => n.id === noteId);

    if (note) {
      await removeFile(note.filePath);
      return true;
    }
  }

  return false;
}
