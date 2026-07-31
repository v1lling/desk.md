/**
 * Content library - File system operations for docs, assets, and folders
 *
 * This is the barrel module that re-exports everything from the split content modules.
 * Doc CRUD operations live here directly.
 *
 * Split modules:
 * - content-tree.ts: Tree building, extraction, flat doc access
 * - content-folders.ts: Folder CRUD operations
 * - content-move.ts: Move docs between projects/folders
 * - content-import.ts: Import files and create docs in folders
 */
import type { Doc, Asset } from "../types";
import { generateFilename, filenameToId, todayISO, nowISO, generatePreview } from "./parser";
import { decodeDocFrontmatter } from "./frontmatter";
import { getStorage } from "./storage";
import {
  writeMarkdownFile,
  updateMarkdownFile,
  deleteMarkdownFile,
  allocateUniqueFilePath,
} from "./file-operations";
import { getDocsPath } from "./paths";
import { getAllDocs, getAllDocsForWorkspace } from "./content-tree";
import { WORKSPACE_LEVEL_PROJECT_ID } from "./constants";

// Re-export all from split modules
export {
  getNodeKey,
  getContentTree,
  extractDocs,
  extractAssets,
  extractFolderPaths,
  getAllDocs,
  getAllDocsForWorkspace,
  getWorkspaceDocsShell,
} from "./content-tree";
export { createFolder, renameFolder, deleteFolder, moveFolder } from "./content-folders";
export { moveDoc } from "./content-move";
export type { DocLocation } from "./content-move";
export { createDocInFolder, importFiles } from "./content-import";
export type { ConvertibleAction, ImportFilesResult } from "./content-import";

// ============================================================================
// Doc CRUD Operations
// ============================================================================

interface DocFrontmatter extends Record<string, unknown> {
  title: string;
  created?: string;
  updated?: string;
  author?: "ai";
}

/**
 * Get all docs for a workspace (across all projects, including nested folders)
 */
export async function getDocs(workspaceId: string): Promise<Doc[]> {
  return getAllDocsForWorkspace(workspaceId);
}

/**
 * Get docs for a specific project (including nested folders)
 */
export async function getDocsByProject(
  workspaceId: string,
  projectId: string
): Promise<Doc[]> {
  return getAllDocs("project", workspaceId, projectId);
}

/**
 * Get a single doc by ID
 */
export async function getDoc(
  workspaceId: string,
  projectId: string,
  docId: string,
): Promise<Doc | null> {
  const scope = projectId === WORKSPACE_LEVEL_PROJECT_ID ? "workspace" : "project";
  const docs = await getAllDocs(scope, workspaceId, projectId);
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
  templateBody?: string;
  author?: "ai";
}): Promise<Doc> {
  const preferredFilename = generateFilename(data.title);
  const docsPath = await getDocsPath("project", data.workspaceId, data.projectId);
  const { filename, filePath } = await allocateUniqueFilePath(docsPath, preferredFilename);

  const id = filenameToId(filename);
  const content = data.content || `# ${data.title}\n\n${data.templateBody || ""}`;

  const doc: Doc = {
    id,
    projectId: data.projectId,
    workspaceId: data.workspaceId,
    filePath,
    title: data.title,
    created: todayISO(),
    updated: nowISO(),
    author: data.author,
    content,
    preview: generatePreview(content),
  };

  const frontmatter: DocFrontmatter = {
    title: doc.title,
    created: doc.created,
    ...(doc.author && { author: doc.author }),
  };

  // writeMarkdownFile handles mkdir + cache invalidation
  await writeMarkdownFile(filePath, frontmatter, doc.content);

  return doc;
}

/**
 * Update a doc using its file path directly
 */
export async function updateDoc(
  doc: Doc,
  updates: Partial<Pick<Doc, "title" | "content">>
): Promise<Doc | null> {
  // updateMarkdownFile handles cache invalidation + registry notification
  const result = await updateMarkdownFile<Record<string, unknown>>(doc.filePath, (data, body) => ({
    frontmatter: {
      ...data,
      ...(updates.title && { title: updates.title }),
    },
    content: updates.content !== undefined ? updates.content : body,
  }));

  if (!result) return null;
  const metadata = decodeDocFrontmatter(
    result.frontmatter,
    doc.title,
    doc.path ?? doc.filePath,
  ).value;

  return {
    ...doc,
    title: metadata.title,
    created: metadata.created,
    updated: metadata.updated,
    author: metadata.author,
    content: result.content,
    preview: generatePreview(result.content),
  };
}

/**
 * Delete a doc using its file path directly
 */
export async function deleteDoc(doc: Doc): Promise<boolean> {
  // deleteMarkdownFile handles cache invalidation + registry notification
  return deleteMarkdownFile(doc.filePath);
}

/**
 * Delete an asset (non-markdown file)
 */
export async function deleteAsset(asset: Asset): Promise<boolean> {
  if (!(await getStorage().exists(asset.filePath))) {
    console.error(`File not found: ${asset.filePath}`);
    return false;
  }

  await getStorage().removeFile(asset.filePath);
  return true;
}
