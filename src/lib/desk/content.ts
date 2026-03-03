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
import type { Doc, Asset } from "@/types";
import { generateFilename, filenameToId, todayISO, generatePreview } from "./parser";
import { isTauri, removeFile, joinPath, exists } from "./tauri-fs";
import {
  writeMarkdownFile,
  updateMarkdownFile,
  deleteMarkdownFile,
} from "./file-operations";
import { mockDocs } from "./mock-data";
import { PATH_SEGMENTS } from "./constants";
import { getDocsPath } from "./paths";
import { getAllDocs, getAllDocsForWorkspace } from "./content-tree";

// Re-export all from split modules
export { getNodeKey, getContentTree, extractDocs, extractAssets, extractFolderPaths, getAllDocs, getAllDocsForWorkspace } from "./content-tree";
export { createFolder, renameFolder, deleteFolder } from "./content-folders";
export { moveDocToProject, moveDoc } from "./content-move";
export { createDocInFolder, importFiles } from "./content-import";

// ============================================================================
// Doc CRUD Operations
// ============================================================================

interface DocFrontmatter extends Record<string, unknown> {
  title: string;
  created: string;
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
  docId: string
): Promise<Doc | null> {
  const docs = await getAllDocsForWorkspace(workspaceId);
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
    doc.filePath = `~/Desk/${PATH_SEGMENTS.WORKSPACES}/${data.workspaceId}/${PATH_SEGMENTS.PROJECTS}/${data.projectId}/${PATH_SEGMENTS.DOCS}/${filename}`;
    mockDocs.unshift(doc);
    return doc;
  }

  const docsPath = await getDocsPath("project", data.workspaceId, data.projectId);
  const filePath = await joinPath(docsPath, filename);
  doc.filePath = filePath;

  const frontmatter: DocFrontmatter = {
    title: doc.title,
    created: doc.created,
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

  // updateMarkdownFile handles cache invalidation + registry notification
  const result = await updateMarkdownFile<DocFrontmatter>(doc.filePath, (data, body) => ({
    frontmatter: {
      ...data,
      ...(updates.title && { title: updates.title }),
    },
    content: updates.content !== undefined ? updates.content : body,
  }));

  if (!result) return null;

  return {
    ...doc,
    title: result.frontmatter.title,
    content: result.content,
    preview: generatePreview(result.content),
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

  // deleteMarkdownFile handles cache invalidation + registry notification
  return deleteMarkdownFile(doc.filePath);
}

/**
 * Delete an asset (non-markdown file)
 */
export async function deleteAsset(asset: Asset): Promise<boolean> {
  if (!isTauri()) return true;

  if (!(await exists(asset.filePath))) {
    console.error(`File not found: ${asset.filePath}`);
    return false;
  }

  await removeFile(asset.filePath);
  return true;
}
