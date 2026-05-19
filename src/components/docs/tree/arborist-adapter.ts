/**
 * Adapter between our `FileTreeNode[]` shape and react-arborist's expected data.
 *
 * Arborist requires unique `id` per node. Our raw node keys (doc.id, asset.path)
 * can collide between docs/ and ai-docs/ trees, so we qualify them by tree path.
 */

import type { FileTreeNode } from "@/types";
import {
  AI_DOCS_SENTINEL,
  isAITreePath,
  isReservedAIDocsName,
} from "@/lib/desk/tree-path";

export type ArboristNodeKind = "folder" | "doc" | "asset";

export interface ArboristNode {
  /** Unique id within the tree. */
  id: string;
  /** Display name. */
  name: string;
  /** Discriminator for the renderer. */
  kind: ArboristNodeKind;
  /** Tree-relative path of this node (folder path, or parent path joined with id for leaves). */
  treePath: string;
  /** Tree-relative path of the parent folder ("" for root). */
  parentTreePath: string;
  /** Original FileTreeNode. */
  node: FileTreeNode;
  /** Children — undefined for leaves, [] for empty branches (incl. unloaded lazy project stubs). */
  children?: ArboristNode[];
}

function buildId(kind: ArboristNodeKind, treePath: string): string {
  return `${kind}|${treePath}`;
}

/**
 * Recursively map FileTreeNode[] to ArboristNode[]. The `parentTreePath` is "" for the root call.
 */
export function nodesToArborist(
  nodes: FileTreeNode[],
  parentTreePath: string = "",
): ArboristNode[] {
  return nodes.map((node) => {
    if (node.type === "folder") {
      // folder.path is already absolute within the merged tree (AI subtree paths are prefixed by the lib).
      const folderPath = node.folder.path;
      return {
        id: buildId("folder", folderPath),
        name: node.folder.name,
        kind: "folder",
        treePath: folderPath,
        parentTreePath,
        node,
        // Empty children means "lazy/expandable but currently empty" — arborist still renders the chevron.
        children: nodesToArborist(node.folder.children, folderPath),
      };
    }
    if (node.type === "doc") {
      const treePath = parentTreePath
        ? `${parentTreePath}/${node.doc.id}`
        : node.doc.id;
      return {
        id: buildId("doc", treePath),
        name: node.doc.title || node.doc.id,
        kind: "doc",
        treePath,
        parentTreePath,
        node,
      };
    }
    const assetPath = parentTreePath
      ? `${parentTreePath}/${node.asset.id}`
      : node.asset.id;
    return {
      id: buildId("asset", assetPath),
      name: node.asset.id,
      kind: "asset",
      treePath: assetPath,
      parentTreePath,
      node,
    };
  });
}

/**
 * True when a node represents a lazy-loaded project stub (synthesized in workspace overview).
 */
export function isProjectStub(node: ArboristNode): boolean {
  return node.node.type === "folder" && node.node.folder.isProject === true;
}

/**
 * True when a node is the synthetic "AI Docs" folder (top of an AI subtree).
 */
export function isAIDocsRoot(node: ArboristNode): boolean {
  if (node.node.type !== "folder") return false;
  return node.node.folder.path === AI_DOCS_SENTINEL
    || node.node.folder.path.endsWith(`/${AI_DOCS_SENTINEL}`);
}

/**
 * Whether dragging this node is allowed.
 * - Project stubs: not draggable (they represent projects, not real folders).
 * - AI Docs synthetic folder: not draggable.
 * - Everything else: draggable.
 */
export function isDraggable(node: ArboristNode): boolean {
  if (isProjectStub(node)) return false;
  if (isAIDocsRoot(node)) return false;
  return true;
}

/**
 * Whether dropping `dragNodes` into `parentNode` is allowed.
 * - Cannot drop into a doc or asset.
 * - Cannot drop into self / own descendants.
 * - Project stubs are not valid drop targets (they're lazy stubs; we don't support cross-project drag yet).
 */
export function canDropInto(
  parentNode: ArboristNode | null,
  dragNodes: ArboristNode[],
): boolean {
  if (!parentNode) return true; // root drop allowed
  if (parentNode.kind !== "folder") return false;
  if (isProjectStub(parentNode)) return false;
  for (const dn of dragNodes) {
    if (dn.id === parentNode.id) return false;
    if (parentNode.treePath.startsWith(`${dn.treePath}/`)) return false;
  }
  return true;
}

/**
 * Whether a new folder name is acceptable at the given parent path.
 * Blocks creating a folder literally named "AI Docs" at any human-side root
 * (collision with the synthetic AI Docs subfolder).
 */
export function isAllowedNewFolderName(parentTreePath: string, name: string): boolean {
  if (!isReservedAIDocsName(name)) return true;
  // Reserved only outside AI Docs subtree — inside ai-docs/ users could legitimately create
  // a subfolder named "AI Docs" (uncommon but not harmful).
  return isAITreePath(parentTreePath);
}
