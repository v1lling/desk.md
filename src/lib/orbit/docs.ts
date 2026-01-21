/**
 * Docs library - File system operations for docs
 */
import type { Doc, DocFolder, DocTreeNode, DocScope } from "@/types";
import { parseMarkdown, serializeMarkdown, generateFilename, filenameToId, todayISO, normalizeDate, generatePreview } from "./parser";
import {
  isTauri,
  getOrbitPath,
  readDir,
  readTextFile,
  writeTextFile,
  mkdir,
  removeFile,
  removeDir,
  rename,
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

// ============================================================================
// Tree Building and Folder Operations
// ============================================================================

/**
 * Get the base docs path for a given scope
 */
export async function getDocsBasePath(
  scope: DocScope,
  workspaceId?: string,
  projectId?: string
): Promise<string> {
  const orbitPath = await getOrbitPath();

  if (scope === "personal") {
    return joinPath(orbitPath, PATH_SEGMENTS.PERSONAL, PATH_SEGMENTS.DOCS);
  }

  if (!workspaceId) {
    throw new Error("workspaceId required for workspace/project scope");
  }

  if (scope === "workspace") {
    return joinPath(
      orbitPath,
      PATH_SEGMENTS.WORKSPACES,
      workspaceId,
      PATH_SEGMENTS.DOCS
    );
  }

  // scope === "project"
  if (!projectId) {
    throw new Error("projectId required for project scope");
  }

  if (isUnassigned(projectId)) {
    return joinPath(
      orbitPath,
      PATH_SEGMENTS.WORKSPACES,
      workspaceId,
      SPECIAL_DIRS.UNASSIGNED,
      PATH_SEGMENTS.DOCS
    );
  }

  return joinPath(
    orbitPath,
    PATH_SEGMENTS.WORKSPACES,
    workspaceId,
    PATH_SEGMENTS.PROJECTS,
    projectId,
    PATH_SEGMENTS.DOCS
  );
}

/**
 * Recursively build a doc tree from a directory
 */
async function buildDocTreeRecursive(
  basePath: string,
  relativePath: string,
  scope: DocScope,
  workspaceId: string,
  projectId: string
): Promise<DocTreeNode[]> {
  const currentPath = relativePath
    ? await joinPath(basePath, relativePath)
    : basePath;

  if (!(await exists(currentPath))) {
    return [];
  }

  const entries = await readDir(currentPath);
  const nodes: DocTreeNode[] = [];

  // Separate folders and files
  const folders = entries.filter(
    (e) => e.isDirectory && !e.name.startsWith(".")
  );
  const files = entries.filter((e) => e.isFile && e.name.endsWith(".md"));

  // Process folders first (sorted alphabetically)
  folders.sort((a, b) => a.name.localeCompare(b.name));
  for (const folder of folders) {
    const folderRelPath = relativePath
      ? `${relativePath}/${folder.name}`
      : folder.name;

    const children = await buildDocTreeRecursive(
      basePath,
      folderRelPath,
      scope,
      workspaceId,
      projectId
    );

    nodes.push({
      type: "folder",
      folder: {
        name: folder.name,
        path: folderRelPath,
        children,
      },
    });
  }

  // Process files (sorted by name)
  files.sort((a, b) => a.name.localeCompare(b.name));
  for (const file of files) {
    try {
      const filePath = await joinPath(currentPath, file.name);
      const content = await readTextFile(filePath);
      const { data, content: body } = parseMarkdown<DocFrontmatter>(content);

      const docRelPath = relativePath
        ? `${relativePath}/${file.name}`
        : file.name;

      nodes.push({
        type: "doc",
        doc: {
          id: filenameToId(file.name),
          path: docRelPath,
          projectId,
          workspaceId,
          filePath,
          title: data.title || file.name.replace(".md", ""),
          created: normalizeDate(data.created),
          content: body,
          preview: generatePreview(body),
        },
      });
    } catch (e) {
      console.warn(`Failed to read doc ${file.name}:`, e);
    }
  }

  return nodes;
}

/**
 * Get a doc tree for a given scope
 */
export async function getDocTree(
  scope: DocScope,
  workspaceId?: string,
  projectId?: string
): Promise<DocTreeNode[]> {
  if (!isTauri()) {
    // Return flat mock data as tree (no folders in mock)
    const filtered = mockDocs.filter((doc) => {
      if (scope === "personal") return doc.workspaceId === "_personal";
      if (scope === "workspace") return doc.workspaceId === workspaceId && doc.projectId === "_workspace";
      return doc.workspaceId === workspaceId && doc.projectId === projectId;
    });

    return filtered.map((doc) => ({
      type: "doc" as const,
      doc,
    }));
  }

  const basePath = await getDocsBasePath(scope, workspaceId, projectId);

  // Ensure docs directory exists
  await mkdir(basePath);

  return buildDocTreeRecursive(
    basePath,
    "",
    scope,
    workspaceId || "_personal",
    projectId || (scope === "workspace" ? "_workspace" : "_personal")
  );
}

/**
 * Create a new folder in the docs tree
 */
export async function createDocFolder(
  scope: DocScope,
  folderPath: string, // e.g., "tech" or "tech/api"
  workspaceId?: string,
  projectId?: string
): Promise<DocFolder> {
  const basePath = await getDocsBasePath(scope, workspaceId, projectId);
  const fullPath = await joinPath(basePath, folderPath);

  await mkdir(fullPath);

  const name = folderPath.includes("/")
    ? folderPath.split("/").pop()!
    : folderPath;

  return {
    name,
    path: folderPath,
    children: [],
  };
}

/**
 * Rename a folder in the docs tree
 */
export async function renameDocFolder(
  scope: DocScope,
  oldPath: string,
  newName: string,
  workspaceId?: string,
  projectId?: string
): Promise<DocFolder> {
  const basePath = await getDocsBasePath(scope, workspaceId, projectId);
  const oldFullPath = await joinPath(basePath, oldPath);

  // Build new path - replace last segment with new name
  const pathParts = oldPath.split("/");
  pathParts[pathParts.length - 1] = newName;
  const newPath = pathParts.join("/");
  const newFullPath = await joinPath(basePath, newPath);

  if (!isTauri()) {
    return { name: newName, path: newPath, children: [] };
  }

  await rename(oldFullPath, newFullPath);

  // Rebuild children after rename
  const children = await buildDocTreeRecursive(
    basePath,
    newPath,
    scope,
    workspaceId || "_personal",
    projectId || (scope === "workspace" ? "_workspace" : "_personal")
  );

  return {
    name: newName,
    path: newPath,
    children,
  };
}

/**
 * Delete a folder and all its contents
 */
export async function deleteDocFolder(
  scope: DocScope,
  folderPath: string,
  workspaceId?: string,
  projectId?: string
): Promise<boolean> {
  if (!isTauri()) {
    return true;
  }

  const basePath = await getDocsBasePath(scope, workspaceId, projectId);
  const fullPath = await joinPath(basePath, folderPath);

  if (!(await exists(fullPath))) {
    return false;
  }

  await removeDir(fullPath);
  return true;
}

/**
 * Move a doc to a different folder (within the same scope)
 */
export async function moveDoc(
  scope: DocScope,
  docId: string,
  fromPath: string, // folder path or empty for root
  toPath: string, // folder path or empty for root
  workspaceId?: string,
  projectId?: string
): Promise<Doc | null> {
  if (!isTauri()) {
    const doc = mockDocs.find((d) => d.id === docId);
    if (doc) {
      doc.path = toPath ? `${toPath}/${doc.id}.md` : `${doc.id}.md`;
    }
    return doc || null;
  }

  const basePath = await getDocsBasePath(scope, workspaceId, projectId);

  // Find the source file
  const fromDir = fromPath
    ? await joinPath(basePath, fromPath)
    : basePath;

  if (!(await exists(fromDir))) return null;

  const entries = await readDir(fromDir);
  let sourceFilename: string | null = null;

  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".md") && filenameToId(entry.name) === docId) {
      sourceFilename = entry.name;
      break;
    }
  }

  if (!sourceFilename) return null;

  const sourceFilePath = await joinPath(fromDir, sourceFilename);

  // Read the doc content
  const content = await readTextFile(sourceFilePath);
  const { data, content: body } = parseMarkdown<DocFrontmatter>(content);

  // Ensure target directory exists
  const toDir = toPath ? await joinPath(basePath, toPath) : basePath;
  await mkdir(toDir);

  // Write to new location
  const targetFilePath = await joinPath(toDir, sourceFilename);
  const fileContent = serializeMarkdown(data, body);
  await writeTextFile(targetFilePath, fileContent);

  // Delete original file
  await removeFile(sourceFilePath);

  const newRelPath = toPath
    ? `${toPath}/${sourceFilename}`
    : sourceFilename;

  return {
    id: docId,
    path: newRelPath,
    projectId: projectId || (scope === "workspace" ? "_workspace" : "_personal"),
    workspaceId: workspaceId || "_personal",
    filePath: targetFilePath,
    title: data.title,
    created: normalizeDate(data.created),
    content: body,
    preview: generatePreview(body),
  };
}

/**
 * Create a doc in a specific folder
 */
export async function createDocInFolder(data: {
  scope: DocScope;
  title: string;
  content?: string;
  folderPath?: string; // e.g., "tech" or "tech/api" - omit for root
  workspaceId?: string;
  projectId?: string;
}): Promise<Doc> {
  const filename = generateFilename(data.title);
  const id = filenameToId(filename);
  const content = data.content || `# ${data.title}\n\n`;
  const wsId = data.workspaceId || "_personal";
  const projId = data.projectId || (data.scope === "workspace" ? "_workspace" : "_personal");

  const relPath = data.folderPath
    ? `${data.folderPath}/${filename}`
    : filename;

  const doc: Doc = {
    id,
    path: relPath,
    projectId: projId,
    workspaceId: wsId,
    filePath: "",
    title: data.title,
    created: todayISO(),
    content,
    preview: generatePreview(content),
  };

  if (!isTauri()) {
    doc.filePath = `~/Orbit/${data.scope}/${data.folderPath || ""}/${filename}`;
    mockDocs.unshift(doc);
    return doc;
  }

  const basePath = await getDocsBasePath(data.scope, data.workspaceId, data.projectId);

  // Ensure folder exists
  const folderPath = data.folderPath
    ? await joinPath(basePath, data.folderPath)
    : basePath;
  await mkdir(folderPath);

  const filePath = await joinPath(folderPath, filename);
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
 * Import multiple docs from file contents
 */
export async function importDocs(
  files: Array<{ name: string; content: string }>,
  scope: DocScope,
  folderPath?: string,
  workspaceId?: string,
  projectId?: string
): Promise<Doc[]> {
  const importedDocs: Doc[] = [];

  for (const file of files) {
    // Try to parse frontmatter from file
    let title: string;
    let content: string;

    try {
      const parsed = parseMarkdown<{ title?: string }>(file.content);
      title = parsed.data.title || file.name.replace(/\.(md|markdown|txt)$/i, "");
      content = file.content;
    } catch {
      // If parsing fails, use filename as title and raw content
      title = file.name.replace(/\.(md|markdown|txt)$/i, "");
      content = file.content;
    }

    const doc = await createDocInFolder({
      scope,
      title,
      content,
      folderPath,
      workspaceId,
      projectId,
    });

    importedDocs.push(doc);
  }

  return importedDocs;
}
