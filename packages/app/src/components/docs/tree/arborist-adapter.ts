/**
 * Adapter between our `FileTreeNode[]` shape and react-arborist's expected data.
 *
 * Arborist requires unique `id` per node. Leaf names (a doc's basename, an asset's
 * filename) can collide between the docs/ and context/ trees, so we qualify each node
 * by its tree path (parent treePath joined with the leaf basename).
 */

import i18next from "i18next";
import type { FileTreeNode } from "@desk/core/types";
import {
  CONTEXT_SENTINEL,
  isContextTreePath,
  isReservedContextName,
} from "@desk/core";

export type ArboristNodeKind = "folder" | "doc" | "asset" | "section-header";

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
  /** For "section-header" kind: render a thin top border to separate from the previous group. */
  sectionShowDivider?: boolean;
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
      // folder.path is already absolute within the merged tree (context subtree paths are prefixed by the lib).
      const folderPath = node.folder.path;
      // Core names the synthetic Context root with a stable, non-localized constant (it also
      // backs isReservedContextName / displayTreePath). Localize it here, on the node itself,
      // so the row, the rename input, and the menus all read the translated name.
      const isCtxRoot =
        folderPath === CONTEXT_SENTINEL || folderPath.endsWith(`/${CONTEXT_SENTINEL}`);
      const folderNode: FileTreeNode = isCtxRoot
        ? {
            ...node,
            folder: { ...node.folder, name: i18next.t("pages.docs.tree.contextFolder") },
          }
        : node;
      return {
        id: buildId("folder", folderPath),
        name: folderNode.type === "folder" ? folderNode.folder.name : "",
        kind: "folder",
        treePath: folderPath,
        parentTreePath,
        node: folderNode,
        // Empty children means "lazy/expandable but currently empty" — arborist still renders the chevron.
        children: nodesToArborist(node.folder.children, folderPath),
      };
    }
    if (node.type === "doc") {
      // doc.id is a full scope-relative path (e.g. "MyFolder/doc1"); join the
      // parent treePath (which already carries the folder path + AI prefix) with
      // just the basename so the folder segment isn't duplicated.
      const treePath = parentTreePath
        ? `${parentTreePath}/${node.doc.id.split("/").pop()}`
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
  if (node.kind !== "folder") return false;
  return node.node.type === "folder" && node.node.folder.isProject === true;
}

/**
 * Insert "Workspace" + "Projects" section headers at the top-level boundary.
 * Headers are only added when the list actually mixes non-project and project rows;
 * a list that is all-one-kind renders untouched.
 */
export function insertSectionHeaders(nodes: ArboristNode[]): ArboristNode[] {
  const firstProjectIdx = nodes.findIndex((n) => isProjectStub(n));
  if (firstProjectIdx <= 0) return nodes;
  return [
    makeSectionHeader("section-workspace", i18next.t("pages.docs.tree.sections.workspace"), false),
    ...nodes.slice(0, firstProjectIdx),
    makeSectionHeader("section-projects", i18next.t("pages.docs.tree.sections.projects"), true),
    ...nodes.slice(firstProjectIdx),
  ];
}

function makeSectionHeader(id: string, label: string, showDivider: boolean): ArboristNode {
  return {
    id,
    name: label,
    kind: "section-header",
    treePath: id,
    parentTreePath: "",
    node: { type: "folder", folder: { name: label, path: id, children: [] } } as FileTreeNode,
    children: undefined,
    sectionShowDivider: showDivider,
  };
}

/**
 * True when a node is the synthetic "Context" folder (top of the context subtree).
 */
export function isContextRoot(node: ArboristNode): boolean {
  if (node.node.type !== "folder") return false;
  return node.node.folder.path === CONTEXT_SENTINEL
    || node.node.folder.path.endsWith(`/${CONTEXT_SENTINEL}`);
}

/**
 * Whether dragging this node is allowed.
 * - Project stubs: not draggable (they represent projects, not real folders).
 * - Context synthetic folder: not draggable.
 * - Everything else: draggable.
 */
export function isDraggable(node: ArboristNode): boolean {
  if (isProjectStub(node)) return false;
  if (isContextRoot(node)) return false;
  return true;
}

/**
 * Whether dropping `dragNodes` into `parentNode` is allowed.
 * - Cannot drop into a doc or asset.
 * - Cannot drop into self / own descendants.
 * - Project stubs ARE valid drop targets — dropping a doc onto a project moves it
 *   into that project's docs root (handleMove resolves the stub's scope/projectId).
 */
export function canDropInto(
  parentNode: ArboristNode | null,
  dragNodes: ArboristNode[],
): boolean {
  if (!parentNode) return true; // root drop allowed
  if (parentNode.kind !== "folder") return false;
  for (const dn of dragNodes) {
    if (dn.id === parentNode.id) return false;
    if (parentNode.treePath.startsWith(`${dn.treePath}/`)) return false;
  }
  return true;
}

/**
 * Whether a new folder name is acceptable at the given parent path.
 * Blocks creating a folder literally named "Context" at any records-side root
 * (collision with the synthetic Context subfolder).
 */
export function isAllowedNewFolderName(parentTreePath: string, name: string): boolean {
  if (!isReservedContextName(name)) return true;
  // Reserved only outside the Context subtree — inside context/ a user could legitimately create
  // a subfolder named "Context" (uncommon but not harmful).
  return isContextTreePath(parentTreePath);
}
