import {
  PROJECT_TREE_PATH_PREFIX,
  getScopedEntityKey,
  resolveTreePath,
  type DocLocation,
} from "@desk/core";
import type { Doc, FileTreeNode } from "@desk/core/types";
import type { ArboristNode } from "./arborist-adapter";

export type DocAuthorFilter = "all" | "mine" | "generated";

export interface ProjectMoveTarget {
  id: string;
  name: string;
}

export interface DocMoveTarget {
  label: string;
  isProject?: boolean;
  toTreePath: string;
}

export interface PlannedDocMove {
  kind: "doc";
  docId: string;
  from: DocLocation;
  to: DocLocation;
}

export interface PlannedFolderMove {
  kind: "folder";
  scope: DocLocation["scope"];
  projectId?: string;
  fromPath: string;
  toParentPath: string;
}

export type PlannedTreeMove =
  | PlannedDocMove
  | PlannedFolderMove
  | { kind: "blocked-folder-cross-scope" }
  | { kind: "ignored" };

export function filterTreeByAuthor(
  nodes: FileTreeNode[],
  filter: DocAuthorFilter,
): FileTreeNode[] {
  if (filter === "all") return nodes;

  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "folder") {
      result.push({
        type: "folder",
        folder: {
          ...node.folder,
          docCount: undefined,
          children: filterTreeByAuthor(node.folder.children, filter),
        },
      });
    } else if (node.type === "doc") {
      const isAI = node.doc.author === "ai";
      if (filter === "generated" ? isAI : !isAI) result.push(node);
    } else {
      result.push(node);
    }
  }
  return result;
}

export function filterTreeByQuery(nodes: FileTreeNode[], query: string): FileTreeNode[] {
  if (!query.trim()) return nodes;

  const normalizedQuery = query.toLowerCase();
  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "folder") {
      if (node.folder.isProject) {
        if (node.folder.name.toLowerCase().includes(normalizedQuery)) result.push(node);
        continue;
      }
      const filteredChildren = filterTreeByQuery(node.folder.children, query);
      if (
        filteredChildren.length > 0
        || node.folder.name.toLowerCase().includes(normalizedQuery)
      ) {
        result.push({
          type: "folder",
          folder: {
            ...node.folder,
            children: filteredChildren.length ? filteredChildren : node.folder.children,
          },
        });
      }
    } else if (node.type === "doc") {
      if (
        node.doc.title.toLowerCase().includes(normalizedQuery)
        || node.doc.content?.toLowerCase().includes(normalizedQuery)
      ) {
        result.push(node);
      }
    } else if (node.asset.id.toLowerCase().includes(normalizedQuery)) {
      result.push(node);
    }
  }
  return result;
}

export function collectFolderTreePaths(nodes: FileTreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === "folder" && !node.folder.isProject) {
      paths.push(node.folder.path);
      paths.push(...collectFolderTreePaths(node.folder.children));
    }
  }
  return paths;
}

export function prefixProjectPaths(
  nodes: FileTreeNode[],
  projectId: string,
): FileTreeNode[] {
  const prefix = `${PROJECT_TREE_PATH_PREFIX}${projectId}`;
  return nodes.map((node) => {
    if (node.type !== "folder") return node;
    return {
      type: "folder",
      folder: {
        ...node.folder,
        path: `${prefix}/${node.folder.path}`,
        children: prefixProjectPaths(node.folder.children, projectId),
      },
    };
  });
}

export function composeWorkspaceTree(
  overviewTree: FileTreeNode[],
  projectSubtrees: ReadonlyMap<string, FileTreeNode[]>,
): FileTreeNode[] {
  return overviewTree.map((node) => {
    if (node.type !== "folder" || !node.folder.isProject || !node.folder.projectId) {
      return node;
    }
    const children = projectSubtrees.get(node.folder.projectId);
    return children
      ? { type: "folder", folder: { ...node.folder, children } }
      : node;
  });
}

export function collectProjects(nodes: FileTreeNode[]): ProjectMoveTarget[] {
  const projects: ProjectMoveTarget[] = [];
  for (const node of nodes) {
    if (node.type === "folder" && node.folder.isProject && node.folder.projectId) {
      projects.push({ id: node.folder.projectId, name: node.folder.name });
    }
  }
  return projects;
}

function locationKey(treePath: string): string {
  const location = resolveTreePath(treePath);
  return `${location.scope}|${location.projectId ?? ""}|${location.scopeTreePath}`;
}

export function buildDocMoveTargets({
  parentTreePath,
  workspaceFolderPaths,
  projects,
  workspaceLabel,
}: {
  parentTreePath: string;
  workspaceFolderPaths: string[];
  projects: ProjectMoveTarget[];
  workspaceLabel: string;
}): DocMoveTarget[] {
  const currentLocation = locationKey(parentTreePath);
  const targets: DocMoveTarget[] = [];

  for (const treePath of ["", ...workspaceFolderPaths]) {
    if (locationKey(treePath) !== currentLocation) {
      targets.push({
        label: treePath || workspaceLabel,
        toTreePath: treePath,
      });
    }
  }
  for (const project of projects) {
    const treePath = `${PROJECT_TREE_PATH_PREFIX}${project.id}`;
    if (locationKey(treePath) !== currentLocation) {
      targets.push({ label: project.name, isProject: true, toTreePath: treePath });
    }
  }
  return targets;
}

function toDocLocation(treePath: string): DocLocation {
  const resolved = resolveTreePath(treePath);
  return {
    scope: resolved.scope,
    projectId: resolved.projectId,
    folderPath: resolved.scopeTreePath,
  };
}

export function planDocMove(
  docId: string,
  fromTreePath: string,
  toTreePath: string,
): PlannedDocMove {
  return {
    kind: "doc",
    docId,
    from: toDocLocation(fromTreePath),
    to: toDocLocation(toTreePath),
  };
}

export function planTreeMove(
  node: ArboristNode,
  toTreePath: string,
): PlannedTreeMove {
  if (node.kind === "doc" && node.node.type === "doc") {
    return planDocMove(node.node.doc.id, node.parentTreePath, toTreePath);
  }
  if (node.kind !== "folder" || node.node.type !== "folder" || node.node.folder.isProject) {
    return { kind: "ignored" };
  }

  const source = resolveTreePath(node.treePath);
  const target = resolveTreePath(toTreePath);
  if (source.scope !== target.scope || source.projectId !== target.projectId) {
    return { kind: "blocked-folder-cross-scope" };
  }
  return {
    kind: "folder",
    scope: target.scope,
    projectId: target.projectId,
    fromPath: source.scopeTreePath,
    toParentPath: target.scopeTreePath,
  };
}

export function findSelectedArboristId(
  activeDocKey: string | null,
  nodes: ArboristNode[],
): string | undefined {
  if (!activeDocKey) return undefined;
  for (const node of nodes) {
    if (
      node.kind === "doc"
      && node.node.type === "doc"
      && getScopedEntityKey(node.node.doc) === activeDocKey
    ) {
      return node.id;
    }
    if (node.children) {
      const match = findSelectedArboristId(activeDocKey, node.children);
      if (match) return match;
    }
  }
  return undefined;
}

export function getActivatedDoc(node: ArboristNode): Doc | undefined {
  return node.kind === "doc" && node.node.type === "doc" ? node.node.doc : undefined;
}
