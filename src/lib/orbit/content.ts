/**
 * Content library - File system operations for docs, assets, and folders
 */
import type { Doc, ContentFolder, FileTreeNode, ContentScope, Asset } from "@/types";
import { isMarkdownFile, getExtension } from "./file-utils";
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
import { SPECIAL_DIRS, PATH_SEGMENTS, PERSONAL_SPACE_ID, isUnassigned } from "./constants";
import { getFileTreeService } from "./file-cache";
import { useOpenEditorRegistry } from "@/stores/open-editor-registry";
import { publishPathChange, publishDeleted } from "@/stores/editor-event-bus";

interface DocFrontmatter {
  title: string;
  created: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique key for a tree node (for React rendering)
 */
export function getNodeKey(node: FileTreeNode): string {
  switch (node.type) {
    case 'folder':
      return `folder-${node.folder.path}`;
    case 'doc':
      return `doc-${node.doc.id}`;
    case 'asset':
      return `asset-${node.asset.path}`;
  }
}

/**
 * Delete a file at a given path (shared logic for docs and assets)
 */
async function deleteFileAtPath(filePath: string): Promise<boolean> {
  if (!isTauri()) {
    return true;
  }

  if (!(await exists(filePath))) {
    console.error(`File not found: ${filePath}`);
    return false;
  }

  await removeFile(filePath);
  return true;
}


/**
 * Get all docs for a workspace (across all projects, including nested folders)
 * Delegates to getAllDocsForWorkspace for proper tree-based recursion.
 */
export async function getDocs(workspaceId: string): Promise<Doc[]> {
  return getAllDocsForWorkspace(workspaceId);
}

/**
 * Get docs for a specific project (including nested folders)
 * Delegates to getAllDocs for proper tree-based recursion.
 */
export async function getDocsByProject(
  workspaceId: string,
  projectId: string
): Promise<Doc[]> {
  return getAllDocs("project", workspaceId, projectId);
}

/**
 * Get a single doc by ID
 * Supports both workspace docs and personal docs (when workspaceId is PERSONAL_SPACE_ID)
 */
export async function getDoc(
  workspaceId: string,
  docId: string
): Promise<Doc | null> {
  // Handle personal docs
  if (workspaceId === PERSONAL_SPACE_ID) {
    const docs = await getAllDocs("personal");
    return docs.find((doc) => doc.id === docId) || null;
  }

  // Handle workspace docs
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
    doc.filePath = `~/Orbit/${PATH_SEGMENTS.WORKSPACES}/${data.workspaceId}/${PATH_SEGMENTS.PROJECTS}/${data.projectId}/${PATH_SEGMENTS.DOCS}/${filename}`;
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
 * Update a doc using its file path directly
 * This is the simple, reliable way - we already have the path, use it.
 */
export async function updateDoc(
  doc: Doc,
  updates: Partial<Pick<Doc, "title" | "content">>
): Promise<Doc | null> {
  if (!isTauri()) {
    const index = mockDocs.findIndex((d) => d.id === doc.id);
    if (index === -1) return null;

    const updatedFields: Partial<Doc> = { ...updates };
    if (updates.content) {
      updatedFields.preview = generatePreview(updates.content);
    }

    mockDocs[index] = { ...mockDocs[index], ...updatedFields };
    return mockDocs[index];
  }

  // Use the file path directly - no path guessing needed
  if (!(await exists(doc.filePath))) {
    console.error(`Doc file not found: ${doc.filePath}`);
    return null;
  }

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
 * Delete a doc using its file path directly
 */
export async function deleteDoc(doc: Doc): Promise<boolean> {
  if (!isTauri()) {
    const index = mockDocs.findIndex((d) => d.id === doc.id);
    if (index === -1) return false;
    mockDocs.splice(index, 1);
    return true;
  }

  // Notify editor if file was open
  const registry = useOpenEditorRegistry.getState();
  if (registry.isOpen(doc.filePath)) {
    registry.handlePathDeleted(doc.filePath);
    publishDeleted(doc.filePath);
  }

  return deleteFileAtPath(doc.filePath);
}

/**
 * Delete an asset (non-markdown file)
 */
export async function deleteAsset(asset: Asset): Promise<boolean> {
  return deleteFileAtPath(asset.filePath);
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

  // Notify editor if file was open
  const registry = useOpenEditorRegistry.getState();
  if (registry.isOpen(sourceFilePath)) {
    registry.handlePathChange(sourceFilePath, targetFilePath);
    publishPathChange(sourceFilePath, targetFilePath);
  }

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
 * Get the base content path for a given scope
 */
export async function getContentBasePath(
  scope: ContentScope,
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
 * Recursively build a content tree from a directory
 */
async function buildContentTreeRecursive(
  basePath: string,
  relativePath: string,
  scope: ContentScope,
  workspaceId: string,
  projectId: string
): Promise<FileTreeNode[]> {
  const currentPath = relativePath
    ? await joinPath(basePath, relativePath)
    : basePath;

  if (!(await exists(currentPath))) {
    return [];
  }

  const entries = await readDir(currentPath);
  const nodes: FileTreeNode[] = [];

  // Separate folders and files
  const folders = entries.filter(
    (e) => e.isDirectory && !e.name.startsWith(".")
  );
  // All visible files (not starting with .)
  const allFiles = entries.filter((e) => e.isFile && !e.name.startsWith("."));
  // Split into markdown (editable) and assets (open externally)
  const markdownFiles = allFiles.filter((e) => isMarkdownFile(e.name));
  const assetFiles = allFiles.filter((e) => !isMarkdownFile(e.name));

  // Process folders first (sorted alphabetically)
  folders.sort((a, b) => a.name.localeCompare(b.name));
  for (const folder of folders) {
    const folderRelPath = relativePath
      ? `${relativePath}/${folder.name}`
      : folder.name;

    const children = await buildContentTreeRecursive(
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

  // Process markdown files (sorted by name)
  // Use file-tree service for cached content reads
  const fileTreeService = getFileTreeService();
  markdownFiles.sort((a, b) => a.name.localeCompare(b.name));
  for (const file of markdownFiles) {
    try {
      const filePath = await joinPath(currentPath, file.name);

      // Use cached content from file-tree service
      const content = await fileTreeService.getContentByAbsolutePath<string>(
        filePath,
        (raw) => raw
      );

      if (!content) {
        console.warn(`Failed to read doc ${file.name}: no content`);
        continue;
      }

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

  // Process asset files (non-markdown, metadata only)
  assetFiles.sort((a, b) => a.name.localeCompare(b.name));
  for (const file of assetFiles) {
    const filePath = await joinPath(currentPath, file.name);
    const ext = getExtension(file.name);
    const assetRelPath = relativePath
      ? `${relativePath}/${file.name}`
      : file.name;

    nodes.push({
      type: "asset",
      asset: {
        id: file.name,
        path: assetRelPath,
        projectId,
        workspaceId,
        filePath,
        extension: ext || '',
      },
    });
  }

  return nodes;
}

/**
 * Get a content tree for a given scope
 */
export async function getContentTree(
  scope: ContentScope,
  workspaceId?: string,
  projectId?: string
): Promise<FileTreeNode[]> {
  if (!isTauri()) {
    // Return flat mock data as tree (no folders in mock)
    const filtered = mockDocs.filter((doc) => {
      if (scope === "personal") return doc.workspaceId === PERSONAL_SPACE_ID;
      if (scope === "workspace") return doc.workspaceId === workspaceId && doc.projectId === "_workspace";
      return doc.workspaceId === workspaceId && doc.projectId === projectId;
    });

    return filtered.map((doc) => ({
      type: "doc" as const,
      doc,
    }));
  }

  const basePath = await getContentBasePath(scope, workspaceId, projectId);

  // Ensure docs directory exists
  await mkdir(basePath);

  return buildContentTreeRecursive(
    basePath,
    "",
    scope,
    workspaceId || PERSONAL_SPACE_ID,
    projectId || (scope === "workspace" ? "_workspace" : PERSONAL_SPACE_ID)
  );
}

/**
 * Create a new folder in the content tree
 */
export async function createFolder(
  scope: ContentScope,
  folderPath: string, // e.g., "tech" or "tech/api"
  workspaceId?: string,
  projectId?: string
): Promise<ContentFolder> {
  const basePath = await getContentBasePath(scope, workspaceId, projectId);
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
 * Rename a folder in the content tree
 */
export async function renameFolder(
  scope: ContentScope,
  oldPath: string,
  newName: string,
  workspaceId?: string,
  projectId?: string
): Promise<ContentFolder> {
  const basePath = await getContentBasePath(scope, workspaceId, projectId);
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
  const children = await buildContentTreeRecursive(
    basePath,
    newPath,
    scope,
    workspaceId || PERSONAL_SPACE_ID,
    projectId || (scope === "workspace" ? "_workspace" : PERSONAL_SPACE_ID)
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
export async function deleteFolder(
  scope: ContentScope,
  folderPath: string,
  workspaceId?: string,
  projectId?: string
): Promise<boolean> {
  if (!isTauri()) {
    return true;
  }

  const basePath = await getContentBasePath(scope, workspaceId, projectId);
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
  scope: ContentScope,
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

  const basePath = await getContentBasePath(scope, workspaceId, projectId);

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

  // Notify editor if file was open
  const registry = useOpenEditorRegistry.getState();
  if (registry.isOpen(sourceFilePath)) {
    registry.handlePathChange(sourceFilePath, targetFilePath);
    publishPathChange(sourceFilePath, targetFilePath);
  }

  const newRelPath = toPath
    ? `${toPath}/${sourceFilename}`
    : sourceFilename;

  return {
    id: docId,
    path: newRelPath,
    projectId: projectId || (scope === "workspace" ? "_workspace" : PERSONAL_SPACE_ID),
    workspaceId: workspaceId || PERSONAL_SPACE_ID,
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
  scope: ContentScope;
  title: string;
  content?: string;
  folderPath?: string; // e.g., "tech" or "tech/api" - omit for root
  workspaceId?: string;
  projectId?: string;
}): Promise<Doc> {
  const filename = generateFilename(data.title);
  const id = filenameToId(filename);
  const content = data.content || `# ${data.title}\n\n`;
  const wsId = data.workspaceId || PERSONAL_SPACE_ID;
  const projId = data.projectId || (data.scope === "workspace" ? "_workspace" : PERSONAL_SPACE_ID);

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

  const basePath = await getContentBasePath(data.scope, data.workspaceId, data.projectId);

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
/**
 * Import files into a doc folder
 * - Markdown files (.md, .markdown) are imported as editable docs
 * - Other files are copied as assets (binary)
 */
export async function importFiles(
  files: Array<{ name: string; content: string | Uint8Array }>,
  scope: ContentScope,
  folderPath?: string,
  workspaceId?: string,
  projectId?: string
): Promise<{ docs: Doc[]; assets: string[] }> {
  const importedDocs: Doc[] = [];
  const importedAssets: string[] = [];

  // Get the target directory
  const basePath = await getContentBasePath(scope, workspaceId, projectId);
  const targetDir = folderPath ? await joinPath(basePath, folderPath) : basePath;
  await mkdir(targetDir);

  for (const file of files) {
    if (isMarkdownFile(file.name)) {
      // Markdown file - import as editable doc
      const textContent = typeof file.content === 'string'
        ? file.content
        : new TextDecoder().decode(file.content);

      let title: string;
      try {
        const parsed = parseMarkdown<{ title?: string }>(textContent);
        title = parsed.data.title || file.name.replace(/\.(md|markdown|txt)$/i, "");
      } catch {
        title = file.name.replace(/\.(md|markdown|txt)$/i, "");
      }

      const doc = await createDocInFolder({
        scope,
        title,
        content: textContent,
        folderPath,
        workspaceId,
        projectId,
      });

      importedDocs.push(doc);
    } else {
      // Non-markdown file - copy as binary asset
      if (isTauri()) {
        const targetPath = await joinPath(targetDir, file.name);
        const fs = await import("@tauri-apps/plugin-fs");

        if (typeof file.content === 'string') {
          await fs.writeTextFile(targetPath, file.content);
        } else {
          await fs.writeFile(targetPath, file.content);
        }
        importedAssets.push(file.name);
      }
    }
  }

  return { docs: importedDocs, assets: importedAssets };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use importFiles instead
 */
export async function importDocs(
  files: Array<{ name: string; content: string }>,
  scope: ContentScope,
  folderPath?: string,
  workspaceId?: string,
  projectId?: string
): Promise<Doc[]> {
  const result = await importFiles(files, scope, folderPath, workspaceId, projectId);
  return result.docs;
}

// ============================================================================
// Flat Doc Access (using tree internally for full recursion)
// ============================================================================

/**
 * Extract all docs from a file tree (recursive)
 */
export function extractDocs(nodes: FileTreeNode[]): Doc[] {
  const docs: Doc[] = [];

  for (const node of nodes) {
    if (node.type === "doc") {
      docs.push(node.doc);
    } else if (node.type === "folder" && node.folder.children) {
      docs.push(...extractDocs(node.folder.children));
    }
    // Skip 'asset' nodes - they are not Docs
  }

  return docs;
}

/**
 * Extract all assets from a file tree (recursive)
 */
export function extractAssets(nodes: FileTreeNode[]): Asset[] {
  const assets: Asset[] = [];

  for (const node of nodes) {
    if (node.type === "asset") {
      assets.push(node.asset);
    } else if (node.type === "folder" && node.folder.children) {
      assets.push(...extractAssets(node.folder.children));
    }
  }

  return assets;
}

/**
 * Get all docs for a scope as a flat array (includes nested folders)
 * Uses getContentTree internally for proper recursion
 */
export async function getAllDocs(
  scope: ContentScope,
  workspaceId?: string,
  projectId?: string
): Promise<Doc[]> {
  const tree = await getContentTree(scope, workspaceId, projectId);
  const docs = extractDocs(tree);

  // Sort by created date (newest first)
  docs.sort((a, b) => b.created.localeCompare(a.created));

  return docs;
}

/**
 * Get all docs for a workspace across all projects (includes nested folders)
 * Combines workspace-level docs + all project docs
 */
export async function getAllDocsForWorkspace(workspaceId: string): Promise<Doc[]> {
  if (!isTauri()) {
    return mockDocs.filter((doc) => doc.workspaceId === workspaceId);
  }

  const allDocs: Doc[] = [];

  // 1. Get workspace-level docs
  const workspaceDocs = await getAllDocs("workspace", workspaceId);
  allDocs.push(...workspaceDocs);

  // 2. Get all project docs
  const orbitPath = await getOrbitPath();
  const projectsPath = await joinPath(
    orbitPath,
    PATH_SEGMENTS.WORKSPACES,
    workspaceId,
    PATH_SEGMENTS.PROJECTS
  );

  if (await exists(projectsPath)) {
    const projectEntries = await readDir(projectsPath);

    for (const entry of projectEntries) {
      if (entry.isDirectory && !entry.name.startsWith(".") && entry.name !== SPECIAL_DIRS.UNASSIGNED) {
        const projectDocs = await getAllDocs("project", workspaceId, entry.name);
        allDocs.push(...projectDocs);
      }
    }
  }

  // 3. Get unassigned docs
  const unassignedDocs = await getAllDocs("project", workspaceId, SPECIAL_DIRS.UNASSIGNED);
  allDocs.push(...unassignedDocs);

  // Sort all docs by created date (newest first)
  allDocs.sort((a, b) => b.created.localeCompare(a.created));

  return allDocs;
}
