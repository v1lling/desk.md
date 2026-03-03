/**
 * Content Tree - Tree building, extraction, and flat doc access
 */
import type { Doc, FileTreeNode, ContentScope, Asset } from "@/types";
import { isMarkdownFile, getExtension } from "./file-utils";
import { parseMarkdown, filenameToId, normalizeDate, generatePreview } from "./parser";
import { isTauri, readDir, mkdir, joinPath, exists } from "./tauri-fs";
import { mockDocs } from "./mock-data";
import { SPECIAL_DIRS, PATH_SEGMENTS, PERSONAL_WORKSPACE_ID, WORKSPACE_LEVEL_PROJECT_ID } from "./constants";
import { getDocsPath, getProjectsPath } from "./paths";
import { getFileTreeService } from "./file-cache";

interface DocFrontmatter {
  title: string;
  created: string;
}

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
 * Recursively build a content tree from a directory
 */
async function buildContentTreeRecursive(
  basePath: string,
  relativePath: string,
  _scope: ContentScope,
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

  const folders = entries.filter(
    (e) => e.isDirectory && !e.name.startsWith(".")
  );
  const allFiles = entries.filter((e) => e.isFile && !e.name.startsWith("."));
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
      _scope,
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
  const fileTreeService = getFileTreeService();
  markdownFiles.sort((a, b) => a.name.localeCompare(b.name));
  for (const file of markdownFiles) {
    try {
      const filePath = await joinPath(currentPath, file.name);

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
    const filtered = mockDocs.filter((doc) => {
      if (scope === "personal") return doc.workspaceId === PERSONAL_WORKSPACE_ID;
      if (scope === "workspace") return doc.workspaceId === workspaceId && doc.projectId === WORKSPACE_LEVEL_PROJECT_ID;
      return doc.workspaceId === workspaceId && doc.projectId === projectId;
    });

    return filtered.map((doc) => ({
      type: "doc" as const,
      doc,
    }));
  }

  const basePath = await getDocsPath(scope, workspaceId, projectId);

  // Ensure docs directory exists
  await mkdir(basePath);

  return buildContentTreeRecursive(
    basePath,
    "",
    scope,
    workspaceId || PERSONAL_WORKSPACE_ID,
    projectId || (scope === "workspace" ? WORKSPACE_LEVEL_PROJECT_ID : PERSONAL_WORKSPACE_ID)
  );
}

// ============================================================================
// Tree Extraction Utilities
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
 * Extract all folder paths from a file tree (recursive)
 */
export function extractFolderPaths(nodes: FileTreeNode[]): string[] {
  const paths: string[] = [];

  for (const node of nodes) {
    if (node.type === "folder") {
      paths.push(node.folder.path);
      if (node.folder.children) {
        paths.push(...extractFolderPaths(node.folder.children));
      }
    }
  }

  return paths;
}

// ============================================================================
// Flat Doc Access (using tree internally for full recursion)
// ============================================================================

/**
 * Get all docs for a scope as a flat array (includes nested folders)
 */
export async function getAllDocs(
  scope: ContentScope,
  workspaceId?: string,
  projectId?: string
): Promise<Doc[]> {
  const tree = await getContentTree(scope, workspaceId, projectId);
  const docs = extractDocs(tree);
  docs.sort((a, b) => b.created.localeCompare(a.created));
  return docs;
}

/**
 * Get all docs for a workspace across all projects (includes nested folders)
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
  const projectsPath = await getProjectsPath(workspaceId);

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

  allDocs.sort((a, b) => b.created.localeCompare(a.created));
  return allDocs;
}
