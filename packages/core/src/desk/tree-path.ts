/** Translate the Docs tree's project prefixes into physical scope information. */

/** UI-tree prefix used to encode a project subtree. */
export const PROJECT_TREE_PATH_PREFIX = "_project/";

/** Result of resolving a UI-tree path into a concrete scope. */
export interface ResolvedTreePath {
  scope: "workspace" | "project";
  projectId?: string;
  /** Tree-relative path inside the resolved scope. */
  scopeTreePath: string;
}

/**
 * Resolve a UI-tree path into its scope + project-id + path-inside-the-scope.
 *
 * Examples:
 *   "" → { scope: "workspace", scopeTreePath: "" }
 *   "drafts" → { scope: "workspace", scopeTreePath: "drafts" }
 *   "_project/abc" → { scope: "project", projectId: "abc", scopeTreePath: "" }
 *   "_project/abc/research" → { scope: "project", projectId: "abc", scopeTreePath: "research" }
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
 * Translate a UI-tree path into the user-facing display string.
 * - Strips the `_project/<id>/` prefix (user reached the path via the tree row,
 *   so adding the internal project id is redundant noise).
 */
export function displayTreePath(treePath: string): string {
  let path = treePath;
  if (path.startsWith(PROJECT_TREE_PATH_PREFIX)) {
    const after = path.slice(PROJECT_TREE_PATH_PREFIX.length);
    const slash = after.indexOf("/");
    path = slash === -1 ? "" : after.slice(slash + 1);
  }
  return path;
}
