/**
 * Tree-path translator.
 *
 * The /docs UI presents a single merged tree where `ai-docs/` appears as a synthetic
 * subfolder named "AI Docs" at workspace and project roots. On disk, docs/ and ai-docs/
 * are still separate directories — this module translates between the two representations.
 *
 * Tree paths under the AI Docs subfolder are prefixed with `AI_DOCS_SENTINEL`, which
 * is encoded in node `path` strings (e.g. `__ai-docs__/research/q1`). The display name
 * is always `AI_DOCS_FOLDER_NAME` ("AI Docs").
 */

import type { DocKind } from "@/types";

/** Display name shown in the UI for the synthetic AI Docs folder. */
export const AI_DOCS_FOLDER_NAME = "AI Docs";

/** Internal path prefix used to encode "this node lives under ai-docs/" in tree paths. */
export const AI_DOCS_SENTINEL = "__ai-docs__";

/** Prefix used by the merged workspace tree to encode a project subtree. */
export const PROJECT_TREE_PATH_PREFIX = "_project/";

/** Result of resolving a merged-tree path into a concrete scope. */
export interface ResolvedTreePath {
  scope: "workspace" | "project";
  projectId?: string;
  /** Tree-relative path inside the resolved scope (may still contain the AI Docs sentinel). */
  scopeTreePath: string;
}

/**
 * Resolve a merged-tree path into its scope + project-id + path-inside-the-scope.
 *
 * Examples:
 *   "" → { scope: "workspace", scopeTreePath: "" }
 *   "drafts" → { scope: "workspace", scopeTreePath: "drafts" }
 *   "_project/abc" → { scope: "project", projectId: "abc", scopeTreePath: "" }
 *   "_project/abc/research" → { scope: "project", projectId: "abc", scopeTreePath: "research" }
 *   "_project/abc/__ai-docs__/notes" → { scope: "project", projectId: "abc", scopeTreePath: "__ai-docs__/notes" }
 */
export function resolveTreePath(treePath: string): ResolvedTreePath {
  if (treePath.startsWith(PROJECT_TREE_PATH_PREFIX)) {
    const after = treePath.slice(PROJECT_TREE_PATH_PREFIX.length);
    const slash = after.indexOf("/");
    if (slash === -1) {
      return { scope: "project", projectId: after, scopeTreePath: "" };
    }
    return {
      scope: "project",
      projectId: after.slice(0, slash),
      scopeTreePath: after.slice(slash + 1),
    };
  }
  return { scope: "workspace", scopeTreePath: treePath };
}

/**
 * Translate a merged-tree path into the user-facing display string.
 * - Strips the `_project/<id>/` prefix (user reached the path via the tree row,
 *   so adding the internal project id is redundant noise).
 * - Replaces the AI Docs sentinel with its display name.
 */
export function displayTreePath(treePath: string): string {
  let path = treePath;
  if (path.startsWith(PROJECT_TREE_PATH_PREFIX)) {
    const after = path.slice(PROJECT_TREE_PATH_PREFIX.length);
    const slash = after.indexOf("/");
    path = slash === -1 ? "" : after.slice(slash + 1);
  }
  if (path === AI_DOCS_SENTINEL) return AI_DOCS_FOLDER_NAME;
  if (path.startsWith(`${AI_DOCS_SENTINEL}/`)) {
    return `${AI_DOCS_FOLDER_NAME}/${path.slice(AI_DOCS_SENTINEL.length + 1)}`;
  }
  return path;
}

/**
 * Translate a tree-relative path into the on-disk kind + path-inside-that-kind.
 *
 * Examples:
 *   "" → { kind: "human", subPath: "" }
 *   "foo" → { kind: "human", subPath: "foo" }
 *   "foo/bar" → { kind: "human", subPath: "foo/bar" }
 *   "__ai-docs__" → { kind: "ai", subPath: "" }
 *   "__ai-docs__/research" → { kind: "ai", subPath: "research" }
 */
export function splitTreePathToKind(treePath: string): { kind: DocKind; subPath: string } {
  if (treePath === AI_DOCS_SENTINEL) {
    return { kind: "ai", subPath: "" };
  }
  if (treePath.startsWith(`${AI_DOCS_SENTINEL}/`)) {
    return { kind: "ai", subPath: treePath.slice(AI_DOCS_SENTINEL.length + 1) };
  }
  return { kind: "human", subPath: treePath };
}

/**
 * Inverse of splitTreePathToKind — build a tree path from kind + on-disk subpath.
 */
export function joinTreePathFromKind(kind: DocKind, subPath: string): string {
  if (kind === "ai") {
    return subPath ? `${AI_DOCS_SENTINEL}/${subPath}` : AI_DOCS_SENTINEL;
  }
  return subPath;
}

/** True when a tree-relative path lives under the synthetic AI Docs subfolder. */
export function isAITreePath(treePath: string): boolean {
  return treePath === AI_DOCS_SENTINEL || treePath.startsWith(`${AI_DOCS_SENTINEL}/`);
}

/** True when a workspace-relative on-disk path lives inside any `ai-docs/` directory. */
export function isAIDocPath(workspaceRelPath: string): boolean {
  return workspaceRelPath === "ai-docs"
    || workspaceRelPath.startsWith("ai-docs/")
    || workspaceRelPath.includes("/ai-docs/")
    || workspaceRelPath.endsWith("/ai-docs");
}

/** True when a folder name conflicts with the reserved AI Docs name. */
export function isReservedAIDocsName(name: string): boolean {
  return name.trim().toLowerCase() === AI_DOCS_FOLDER_NAME.toLowerCase();
}

/** True when an absolute filePath lives under an `/ai-docs/` segment. */
export function filePathIsAIKind(filePath: string): boolean {
  return filePath.includes("/ai-docs/");
}
