import { extractDocs, extractAssets } from "@desk/core";
import type { FileTreeNode } from "@desk/core/types";

/**
 * Count docs + assets across an overview tree. Project folders are lazy stubs
 * (children not loaded), so their precomputed recursive counts are used;
 * regular folders have a fully populated subtree and are counted inline.
 */
export function countTreeFiles(nodes: FileTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "doc" || node.type === "asset") {
      count++;
    } else if (node.type === "folder" && node.folder.isProject) {
      count += (node.folder.docCount ?? 0) + (node.folder.assetCount ?? 0);
    } else if (node.type === "folder") {
      count += extractDocs([node]).length + extractAssets([node]).length;
    }
  }
  return count;
}

/** Case-insensitive substring match across any of the given fields. Empty query matches all. */
export function matchesSearch(query: string, ...fields: (string | undefined | null)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q));
}
