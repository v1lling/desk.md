/**
 * Content Folders - Folder CRUD operations within the content tree
 */
import type { ContentFolder, ContentScope, DocKind } from "../types";
import { isMockMode, joinPath } from "./env";
import { getStorage } from "./storage";
import { WORKSPACE_LEVEL_PROJECT_ID } from "./constants";
import { getDocsPath, getContextPath } from "./paths";
import { getHomeWorkspaceId } from "./workspaces";

import { getContentTree } from "./content-tree";

function getBasePath(kind: DocKind, scope: ContentScope, workspaceId?: string, projectId?: string) {
  return kind === "context"
    ? getContextPath(scope, workspaceId, projectId)
    : getDocsPath(scope, workspaceId, projectId);
}

/**
 * Create a new folder in the content tree
 */
export async function createFolder(
  scope: ContentScope,
  folderPath: string,
  workspaceId?: string,
  projectId?: string,
  kind: DocKind = "doc"
): Promise<ContentFolder> {
  const basePath = await getBasePath(kind, scope, workspaceId, projectId);
  const fullPath = await joinPath(basePath, folderPath);

  await getStorage().mkdir(fullPath);

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
  projectId?: string,
  kind: DocKind = "doc"
): Promise<ContentFolder> {
  const basePath = await getBasePath(kind, scope, workspaceId, projectId);
  const oldFullPath = await joinPath(basePath, oldPath);

  const pathParts = oldPath.split("/");
  pathParts[pathParts.length - 1] = newName;
  const newPath = pathParts.join("/");
  const newFullPath = await joinPath(basePath, newPath);

  if (isMockMode()) {
    return { name: newName, path: newPath, children: [] };
  }

  await getStorage().rename(oldFullPath, newFullPath);

  // Rebuild children by fetching the tree for the renamed folder's scope
  // We get the full tree and extract the renamed folder's children
  const homeWorkspaceId = await getHomeWorkspaceId();
  const tree = await getContentTree(
    scope,
    workspaceId || homeWorkspaceId,
    projectId || (scope === "workspace" ? WORKSPACE_LEVEL_PROJECT_ID : homeWorkspaceId),
    kind
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
 * Move a folder to a new parent folder.
 * e.g. moveFolder("tech", "archive") moves "tech" → "archive/tech"
 * moveFolder("archive/tech", "") moves "archive/tech" → "tech" (root)
 */
export async function moveFolder(
  scope: ContentScope,
  fromPath: string,
  toParentPath: string,
  workspaceId?: string,
  projectId?: string,
  kind: DocKind = "doc"
): Promise<boolean> {
  // Prevent moving into itself or descendants
  if (toParentPath === fromPath || toParentPath.startsWith(fromPath + "/")) {
    return false;
  }

  const folderName = fromPath.includes("/")
    ? fromPath.split("/").pop()!
    : fromPath;

  const newPath = toParentPath ? `${toParentPath}/${folderName}` : folderName;

  if (newPath === fromPath) return false;

  if (isMockMode()) {
    return true;
  }

  const basePath = await getBasePath(kind, scope, workspaceId, projectId);
  const oldFullPath = await joinPath(basePath, fromPath);
  const newFullPath = await joinPath(basePath, newPath);

  // Ensure target parent exists
  if (toParentPath) {
    const parentFullPath = await joinPath(basePath, toParentPath);
    if (!(await getStorage().exists(parentFullPath))) {
      await getStorage().mkdir(parentFullPath);
    }
  }

  await getStorage().rename(oldFullPath, newFullPath);
  return true;
}

/**
 * Delete a folder and all its contents
 */
export async function deleteFolder(
  scope: ContentScope,
  folderPath: string,
  workspaceId?: string,
  projectId?: string,
  kind: DocKind = "doc"
): Promise<boolean> {
  if (isMockMode()) {
    return true;
  }

  const basePath = await getBasePath(kind, scope, workspaceId, projectId);
  const fullPath = await joinPath(basePath, folderPath);

  if (!(await getStorage().exists(fullPath))) {
    return false;
  }

  await getStorage().removeDir(fullPath);
  return true;
}
