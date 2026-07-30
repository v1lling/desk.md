/**
 * Pure traversal helpers for content trees.
 *
 * Keep these independent from storage-backed tree construction so callers can
 * transform an already-loaded tree without pulling in host I/O.
 */
import type { Asset, Doc, FileTreeNode } from "../types";

/**
 * Generate a unique key for a tree node (for React rendering).
 */
export function getNodeKey(node: FileTreeNode): string {
  switch (node.type) {
    case "folder":
      return `folder-${node.folder.path}`;
    case "doc":
      return `doc-${node.doc.id}`;
    case "asset":
      return `asset-${node.asset.path}`;
  }
}

/**
 * Extract all docs from a file tree in depth-first display order.
 */
export function extractDocs(nodes: FileTreeNode[]): Doc[] {
  const docs: Doc[] = [];

  for (const node of nodes) {
    if (node.type === "doc") {
      docs.push(node.doc);
    } else if (node.type === "folder") {
      docs.push(...extractDocs(node.folder.children));
    }
  }

  return docs;
}

/**
 * Extract all assets from a file tree in depth-first display order.
 */
export function extractAssets(nodes: FileTreeNode[]): Asset[] {
  const assets: Asset[] = [];

  for (const node of nodes) {
    if (node.type === "asset") {
      assets.push(node.asset);
    } else if (node.type === "folder") {
      assets.push(...extractAssets(node.folder.children));
    }
  }

  return assets;
}

/**
 * Extract all folder paths from a file tree in depth-first display order.
 */
export function extractFolderPaths(nodes: FileTreeNode[]): string[] {
  const paths: string[] = [];

  for (const node of nodes) {
    if (node.type === "folder") {
      paths.push(node.folder.path);
      paths.push(...extractFolderPaths(node.folder.children));
    }
  }

  return paths;
}
