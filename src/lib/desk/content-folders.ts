/**
 * Content Folders - Folder CRUD operations within the content tree
 */
import type { ContentFolder, ContentScope } from "@/types";
import { isTauri, removeDir, rename, mkdir, joinPath, exists } from "./tauri-fs";
import { PERSONAL_WORKSPACE_ID, WORKSPACE_LEVEL_PROJECT_ID } from "./constants";
import { getDocsPath } from "./paths";

import { getContentTree } from "./content-tree";

/**
 * Create a new folder in the content tree
 */
export async function createFolder(
  scope: ContentScope,
  folderPath: string,
  workspaceId?: string,
  projectId?: string
): Promise<ContentFolder> {
  const basePath = await getDocsPath(scope, workspaceId, projectId);
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
  const basePath = await getDocsPath(scope, workspaceId, projectId);
  const oldFullPath = await joinPath(basePath, oldPath);

  const pathParts = oldPath.split("/");
  pathParts[pathParts.length - 1] = newName;
  const newPath = pathParts.join("/");
  const newFullPath = await joinPath(basePath, newPath);

  if (!isTauri()) {
    return { name: newName, path: newPath, children: [] };
  }

  await rename(oldFullPath, newFullPath);

  // Rebuild children by fetching the tree for the renamed folder's scope
  // We get the full tree and extract the renamed folder's children
  const tree = await getContentTree(
    scope,
    workspaceId || PERSONAL_WORKSPACE_ID,
    projectId || (scope === "workspace" ? WORKSPACE_LEVEL_PROJECT_ID : PERSONAL_WORKSPACE_ID)
  );

  // Find the renamed folder in the tree
  function findFolder(nodes: typeof tree, path: string): typeof tree {
    for (const node of nodes) {
      if (node.type === "folder") {
        if (node.folder.path === path) return node.folder.children;
        const found = findFolder(node.folder.children, path);
        if (found.length > 0) return found;
      }
    }
    return [];
  }

  const children = findFolder(tree, newPath);

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

  const basePath = await getDocsPath(scope, workspaceId, projectId);
  const fullPath = await joinPath(basePath, folderPath);

  if (!(await exists(fullPath))) {
    return false;
  }

  await removeDir(fullPath);
  return true;
}
