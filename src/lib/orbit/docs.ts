/**
 * Docs library - File system operations for docs
 */
import type { Doc } from "@/types";
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
import { mockDocs } from "./mock-data";
import { SPECIAL_DIRS, PATH_SEGMENTS, isUnassigned } from "./constants";
import { findItemInAllWorkspaces } from "./search";

interface DocFrontmatter {
  title: string;
  created: string;
}

/**
 * Read all docs from a project's docs directory
 */
async function readProjectDocs(
  workspaceId: string,
  projectId: string,
  projectPath: string
): Promise<Doc[]> {
  const docsPath = await joinPath(projectPath, PATH_SEGMENTS.DOCS);

  if (!(await exists(docsPath))) {
    return [];
  }

  const entries = await readDir(docsPath);
  const docs: Doc[] = [];

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      try {
        const docPath = await joinPath(docsPath, entry.name);
        const content = await readTextFile(docPath);
        const { data, content: body } = parseMarkdown<DocFrontmatter>(content);

        docs.push({
          id: filenameToId(entry.name),
          projectId,
          workspaceId,
          filePath: docPath,
          title: data.title || entry.name,
          created: normalizeDate(data.created),
          content: body,
          preview: generatePreview(body),
        });
      } catch (e) {
        console.warn(`Failed to read doc ${entry.name}:`, e);
      }
    }
  }

  // Sort by created date (newest first)
  docs.sort((a, b) => b.created.localeCompare(a.created));

  return docs;
}

/**
 * Get all docs for a workspace (across all projects)
 */
export async function getDocs(workspaceId: string): Promise<Doc[]> {
  if (!isTauri()) {
    return mockDocs.filter((doc) => doc.workspaceId === workspaceId);
  }

  const orbitPath = await getOrbitPath();
  const projectsPath = await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS);

  if (!(await exists(projectsPath))) {
    return [];
  }

  const projectEntries = await readDir(projectsPath);
  const allDocs: Doc[] = [];

  for (const entry of projectEntries) {
    if (entry.isDirectory && !entry.name.startsWith(".") && entry.name !== SPECIAL_DIRS.UNASSIGNED) {
      const projectPath = await joinPath(projectsPath, entry.name);
      const projectDocs = await readProjectDocs(workspaceId, entry.name, projectPath);
      allDocs.push(...projectDocs);
    }
  }

  // Also read unassigned docs
  const unassignedPath = await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, SPECIAL_DIRS.UNASSIGNED);
  if (await exists(unassignedPath)) {
    const unassignedDocs = await readProjectDocs(workspaceId, SPECIAL_DIRS.UNASSIGNED, unassignedPath);
    allDocs.push(...unassignedDocs);
  }

  // Sort all docs by created date (newest first)
  allDocs.sort((a, b) => b.created.localeCompare(a.created));

  return allDocs;
}

/**
 * Get docs for a specific project
 */
export async function getDocsByProject(
  workspaceId: string,
  projectId: string
): Promise<Doc[]> {
  if (!isTauri()) {
    return mockDocs.filter((doc) => doc.workspaceId === workspaceId && doc.projectId === projectId);
  }

  const orbitPath = await getOrbitPath();
  const projectPath = isUnassigned(projectId)
    ? await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, SPECIAL_DIRS.UNASSIGNED)
    : await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS, projectId);

  return readProjectDocs(workspaceId, projectId, projectPath);
}

/**
 * Get a single doc by ID
 */
export async function getDoc(
  workspaceId: string,
  docId: string
): Promise<Doc | null> {
  const docs = await getDocs(workspaceId);
  return docs.find((doc) => doc.id === docId) || null;
}

/**
 * Create a new doc
 */
export async function createDoc(data: {
  workspaceId: string;
  projectId: string;
  title: string;
  content?: string;
}): Promise<Doc> {
  const filename = generateFilename(data.title);
  const id = filenameToId(filename);
  const content = data.content || `# ${data.title}\n\n`;

  const doc: Doc = {
    id,
    projectId: data.projectId,
    workspaceId: data.workspaceId,
    filePath: "",
    title: data.title,
    created: todayISO(),
    content,
    preview: generatePreview(content),
  };

  if (!isTauri()) {
    doc.filePath = `~/Orbit/workspaces/${data.workspaceId}/projects/${data.projectId}/docs/${filename}`;
    mockDocs.unshift(doc);
    return doc;
  }

  const orbitPath = await getOrbitPath();
  const docsPath = isUnassigned(data.projectId)
    ? await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, data.workspaceId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.DOCS)
    : await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, data.workspaceId, PATH_SEGMENTS.PROJECTS, data.projectId, PATH_SEGMENTS.DOCS);

  // Ensure docs directory exists
  await mkdir(docsPath);

  const filePath = await joinPath(docsPath, filename);
  doc.filePath = filePath;

  // Create doc file
  const frontmatter: DocFrontmatter = {
    title: doc.title,
    created: doc.created,
  };

  const fileContent = serializeMarkdown(frontmatter, doc.content);
  await writeTextFile(filePath, fileContent);

  return doc;
}

/**
 * Update a doc
 */
export async function updateDoc(
  docId: string,
  updates: Partial<Pick<Doc, "title" | "content">>,
  workspaceId?: string,
  projectId?: string
): Promise<Doc | null> {
  if (!isTauri()) {
    const index = mockDocs.findIndex((d) => d.id === docId);
    if (index === -1) return null;

    const updatedFields: Partial<Doc> = { ...updates };
    if (updates.content) {
      updatedFields.preview = generatePreview(updates.content);
    }

    mockDocs[index] = { ...mockDocs[index], ...updatedFields };
    return mockDocs[index];
  }

  // If we have workspaceId and projectId, we can directly locate the file (fast path)
  if (workspaceId && projectId) {
    const orbitPath = await getOrbitPath();
    const docsPath = isUnassigned(projectId)
      ? await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.DOCS)
      : await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS, projectId, PATH_SEGMENTS.DOCS);

    if (await exists(docsPath)) {
      const entries = await readDir(docsPath);
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith(".md") && filenameToId(entry.name) === docId) {
          const filePath = await joinPath(docsPath, entry.name);
          const content = await readTextFile(filePath);
          const { data, content: body } = parseMarkdown<DocFrontmatter>(content);

          const updatedData: DocFrontmatter = {
            ...data,
            ...(updates.title && { title: updates.title }),
          };

          const updatedContent = updates.content !== undefined ? updates.content : body;
          const fileContent = serializeMarkdown(updatedData, updatedContent);
          await writeTextFile(filePath, fileContent);

          return {
            id: docId,
            projectId,
            workspaceId,
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

  // Fallback: search all workspaces (slow path) - uses helper to find item
  const doc = await findItemInAllWorkspaces(docId, getDocs);
  if (!doc) return null;

  // Read existing file and update
  const content = await readTextFile(doc.filePath);
  const { data } = parseMarkdown<DocFrontmatter>(content);

  const updatedData: DocFrontmatter = {
    ...data,
    ...(updates.title && { title: updates.title }),
  };

  const updatedContent = updates.content !== undefined ? updates.content : doc.content;
  const fileContent = serializeMarkdown(updatedData, updatedContent);
  await writeTextFile(doc.filePath, fileContent);

  return {
    ...doc,
    title: updatedData.title,
    content: updatedContent,
    preview: generatePreview(updatedContent),
  };
}

/**
 * Delete a doc
 */
export async function deleteDoc(
  docId: string,
  workspaceId?: string,
  projectId?: string
): Promise<boolean> {
  if (!isTauri()) {
    const index = mockDocs.findIndex((d) => d.id === docId);
    if (index === -1) return false;
    mockDocs.splice(index, 1);
    return true;
  }

  // If we have workspaceId and projectId, we can directly locate the file (fast path)
  if (workspaceId && projectId) {
    const orbitPath = await getOrbitPath();
    const docsPath = isUnassigned(projectId)
      ? await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.DOCS)
      : await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS, projectId, PATH_SEGMENTS.DOCS);

    if (await exists(docsPath)) {
      const entries = await readDir(docsPath);
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith(".md") && filenameToId(entry.name) === docId) {
          const filePath = await joinPath(docsPath, entry.name);
          await removeFile(filePath);
          return true;
        }
      }
    }
    return false;
  }

  // Fallback: search all workspaces (slow path) - uses helper to find item
  const doc = await findItemInAllWorkspaces(docId, getDocs);
  if (!doc) return false;

  await removeFile(doc.filePath);
  return true;
}

/**
 * Move doc to a different project (physically moves the file)
 */
export async function moveDocToProject(
  docId: string,
  workspaceId: string,
  fromProjectId: string,
  toProjectId: string
): Promise<Doc | null> {
  if (!isTauri()) {
    const index = mockDocs.findIndex((d) => d.id === docId && d.workspaceId === workspaceId);
    if (index === -1) return null;
    mockDocs[index] = { ...mockDocs[index], projectId: toProjectId };
    return mockDocs[index];
  }

  if (fromProjectId === toProjectId) {
    // No move needed
    const docs = await getDocs(workspaceId);
    return docs.find((d) => d.id === docId) || null;
  }

  const orbitPath = await getOrbitPath();

  // Find the source file
  const fromDocsPath = isUnassigned(fromProjectId)
    ? await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.DOCS)
    : await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS, fromProjectId, PATH_SEGMENTS.DOCS);

  if (!(await exists(fromDocsPath))) return null;

  const entries = await readDir(fromDocsPath);
  let sourceFilename: string | null = null;

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md") && filenameToId(entry.name) === docId) {
      sourceFilename = entry.name;
      break;
    }
  }

  if (!sourceFilename) return null;

  const sourceFilePath = await joinPath(fromDocsPath, sourceFilename);

  // Read the doc content
  const content = await readTextFile(sourceFilePath);
  const { data, content: body } = parseMarkdown<DocFrontmatter>(content);

  // Ensure target directory exists
  const toDocsPath = isUnassigned(toProjectId)
    ? await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.DOCS)
    : await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES, workspaceId, PATH_SEGMENTS.PROJECTS, toProjectId, PATH_SEGMENTS.DOCS);

  await mkdir(toDocsPath);

  // Write to new location
  const targetFilePath = await joinPath(toDocsPath, sourceFilename);
  const fileContent = serializeMarkdown(data, body);
  await writeTextFile(targetFilePath, fileContent);

  // Delete original file
  await removeFile(sourceFilePath);

  return {
    id: docId,
    projectId: toProjectId,
    workspaceId,
    filePath: targetFilePath,
    title: data.title,
    created: normalizeDate(data.created),
    content: body,
    preview: generatePreview(body),
  };
}
