/**
 * Tree-path translator.
 *
 * The /docs UI presents a single merged tree where `context/` appears as a synthetic
 * subfolder named "Context", pinned first at workspace and project roots. On disk,
 * docs/ and context/ are separate directories — this module translates between the
 * two representations.
 *
 * The docs/ vs context/ split is a LIFECYCLE distinction, not an authorship one:
 * docs/ (with tasks/ and meetings/) holds dated records that accumulate and are never
 * rewritten; context/ holds the evergreen, maintained map of how things currently are.
 * Both the user and AI write in both.
 *
 * Tree paths under the Context subfolder are prefixed with `CONTEXT_SENTINEL`, which
 * is encoded in node `path` strings (e.g. `__context__/services`). The display name
 * is always `CONTEXT_FOLDER_NAME` ("Context").
 */

import type { DocKind } from "../types";

/**
 * Display name shown in the UI for the synthetic Context folder.
 *
 * This is the stable, non-localized identity: it backs `isReservedContextName` and
 * `displayTreePath`. The visible tree label is localized separately in the UI layer.
 */
export const CONTEXT_FOLDER_NAME = "Context";

/** Internal path prefix used to encode "this node lives under context/" in tree paths. */
export const CONTEXT_SENTINEL = "__context__";

/** Prefix used by the merged workspace tree to encode a project subtree. */
export const PROJECT_TREE_PATH_PREFIX = "_project/";

/** Result of resolving a merged-tree path into a concrete scope. */
export interface ResolvedTreePath {
  scope: "workspace" | "project";
  projectId?: string;
  /** Tree-relative path inside the resolved scope (may still contain the Context sentinel). */
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
 *   "_project/abc/__context__/services" → { scope: "project", projectId: "abc", scopeTreePath: "__context__/services" }
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
 * - Replaces the Context sentinel with its display name.
 */
export function displayTreePath(treePath: string): string {
  let path = treePath;
  if (path.startsWith(PROJECT_TREE_PATH_PREFIX)) {
    const after = path.slice(PROJECT_TREE_PATH_PREFIX.length);
    const slash = after.indexOf("/");
    path = slash === -1 ? "" : after.slice(slash + 1);
  }
  if (path === CONTEXT_SENTINEL) return CONTEXT_FOLDER_NAME;
  if (path.startsWith(`${CONTEXT_SENTINEL}/`)) {
    return `${CONTEXT_FOLDER_NAME}/${path.slice(CONTEXT_SENTINEL.length + 1)}`;
  }
  return path;
}

/**
 * Translate a tree-relative path into the on-disk kind + path-inside-that-kind.
 *
 * Examples:
 *   "" → { kind: "doc", subPath: "" }
 *   "foo" → { kind: "doc", subPath: "foo" }
 *   "foo/bar" → { kind: "doc", subPath: "foo/bar" }
 *   "__context__" → { kind: "context", subPath: "" }
 *   "__context__/services" → { kind: "context", subPath: "services" }
 */
export function splitTreePathToKind(treePath: string): { kind: DocKind; subPath: string } {
  if (treePath === CONTEXT_SENTINEL) {
    return { kind: "context", subPath: "" };
  }
  if (treePath.startsWith(`${CONTEXT_SENTINEL}/`)) {
    return { kind: "context", subPath: treePath.slice(CONTEXT_SENTINEL.length + 1) };
  }
  return { kind: "doc", subPath: treePath };
}

/** True when a tree-relative path lives under the synthetic Context subfolder. */
export function isContextTreePath(treePath: string): boolean {
  return treePath === CONTEXT_SENTINEL || treePath.startsWith(`${CONTEXT_SENTINEL}/`);
}

/** True when a folder name conflicts with the reserved Context name. */
export function isReservedContextName(name: string): boolean {
  return name.trim().toLowerCase() === CONTEXT_FOLDER_NAME.toLowerCase();
}

/**
 * True when an absolute filePath lives under a workspace's or project's `context/` dir.
 *
 * Anchored on the legal parents rather than a bare `/context/` substring: unlike the
 * old `/ai-docs/`, "context" is an ordinary word a user could name any folder.
 */
const CONTEXT_DIR_RE = /\/(?:workspaces\/[^/]+|projects\/[^/]+)\/context\//;

export function filePathIsContextKind(filePath: string): boolean {
  return CONTEXT_DIR_RE.test(filePath);
}
