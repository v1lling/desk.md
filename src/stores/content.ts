import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Doc, ContentScope, Asset } from "@/types";
import * as contentLib from "@/lib/desk/content";

// Query keys for content (docs, assets, folders)
export const contentKeys = {
  all: ["content"] as const,
  byWorkspace: (workspaceId: string) => [...contentKeys.all, "workspace", workspaceId] as const,
  byProject: (workspaceId: string, projectId: string) =>
    [...contentKeys.byWorkspace(workspaceId), "project", projectId] as const,
  detail: (workspaceId: string, docId: string) =>
    [...contentKeys.byWorkspace(workspaceId), "detail", docId] as const,
  // Tree keys for scoped content trees
  tree: (scope: ContentScope, workspaceId?: string, projectId?: string) =>
    [...contentKeys.all, "tree", scope, workspaceId || "", projectId || ""] as const,
};

/**
 * Hook to fetch all docs for a workspace
 */
export function useDocs(workspaceId: string | null) {
  return useQuery({
    queryKey: contentKeys.byWorkspace(workspaceId || ""),
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return contentLib.getDocs(workspaceId);
    },
    enabled: !!workspaceId,
  });
}

/**
 * Hook to fetch docs for a specific project
 */
export function useProjectDocs(workspaceId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: contentKeys.byProject(workspaceId || "", projectId || ""),
    queryFn: async () => {
      if (!workspaceId || !projectId) throw new Error("workspaceId and projectId are required");
      return contentLib.getDocsByProject(workspaceId, projectId);
    },
    enabled: !!workspaceId && !!projectId,
  });
}

/**
 * Hook to fetch a single doc
 */
export function useDoc(workspaceId: string | null, docId: string | null) {
  return useQuery({
    queryKey: contentKeys.detail(workspaceId || "", docId || ""),
    queryFn: async () => {
      if (!workspaceId || !docId) throw new Error("workspaceId and docId are required");
      return contentLib.getDoc(workspaceId, docId);
    },
    enabled: !!workspaceId && !!docId,
  });
}

/**
 * Hook to create a new doc
 */
export function useCreateDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      workspaceId: string;
      projectId: string;
      title: string;
      content?: string;
    }) => contentLib.createDoc(data),
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.byWorkspace(newDoc.workspaceId),
      });
    },
  });
}

/**
 * Hook to update a doc
 * Pass the full doc object - we use its filePath directly
 */
export function useUpdateDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      doc,
      updates,
    }: {
      doc: Doc;
      updates: Partial<Pick<Doc, "title" | "content">>;
    }) => contentLib.updateDoc(doc, updates),
    onSuccess: (updatedDoc) => {
      if (updatedDoc) {
        // Directly update doc in all cached list queries (avoids stale file-tree cache race).
        // Query invalidation alone would trigger a refetch that reads from the still-stale
        // file cache, causing the UI to snap back to old values briefly.
        queryClient.setQueriesData<Doc[]>(
          { queryKey: contentKeys.all },
          (old) => {
            if (!Array.isArray(old)) return old;
            return old.map(d => d.id === updatedDoc.id ? updatedDoc : d);
          }
        );
        // Also update detail query directly
        queryClient.setQueryData(
          contentKeys.detail(updatedDoc.workspaceId, updatedDoc.id),
          updatedDoc
        );
      }
    },
  });
}

/**
 * Hook to delete a doc
 * Pass the full doc object - we use its filePath directly
 */
export function useDeleteDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (doc: Doc) => contentLib.deleteDoc(doc),
    onSuccess: (success, doc) => {
      if (success) {
        // Invalidate workspace-scoped queries
        queryClient.invalidateQueries({
          queryKey: contentKeys.byWorkspace(doc.workspaceId),
        });
        // Also invalidate relevant tree queries
        queryClient.invalidateQueries({
          queryKey: contentKeys.tree("workspace", doc.workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: contentKeys.tree("project", doc.workspaceId, doc.projectId),
        });
      }
    },
  });
}

/**
 * Hook to delete an asset (non-markdown file)
 */
export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (asset: Asset) => contentLib.deleteAsset(asset),
    onSuccess: (success, asset) => {
      if (success) {
        // Invalidate workspace-scoped queries
        queryClient.invalidateQueries({
          queryKey: contentKeys.byWorkspace(asset.workspaceId),
        });
        // Also invalidate relevant tree queries (assets are in tree)
        queryClient.invalidateQueries({
          queryKey: contentKeys.tree("workspace", asset.workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: contentKeys.tree("project", asset.workspaceId, asset.projectId),
        });
      }
    },
  });
}

/**
 * Hook to move a doc to a different project
 */
export function useMoveDocToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      docId,
      workspaceId,
      fromProjectId,
      toProjectId,
    }: {
      docId: string;
      workspaceId: string;
      fromProjectId: string;
      toProjectId: string;
    }) => contentLib.moveDocToProject(docId, workspaceId, fromProjectId, toProjectId),
    onSuccess: (_result, variables) => {
      // Invalidate workspace docs to refresh lists
      queryClient.invalidateQueries({
        queryKey: contentKeys.byWorkspace(variables.workspaceId),
      });
      // Invalidate the detail query so the doc object refreshes with new filePath/projectId
      queryClient.invalidateQueries({
        queryKey: contentKeys.detail(variables.workspaceId, variables.docId),
      });
    },
  });
}

/**
 * Hook to fetch ALL docs for a workspace (includes nested folders)
 * Uses getDocTree internally for proper recursion through folder structures
 */
export function useAllWorkspaceDocs(workspaceId: string | null) {
  return useQuery({
    queryKey: [...contentKeys.byWorkspace(workspaceId || ""), "all-recursive"] as const,
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return contentLib.getAllDocsForWorkspace(workspaceId);
    },
    enabled: !!workspaceId,
  });
}

// ============================================================================
// Tree-based hooks for scoped content trees
// ============================================================================

/**
 * Hook to fetch a content tree for a given scope
 */
export function useContentTree(
  scope: ContentScope,
  workspaceId?: string | null,
  projectId?: string | null
) {
  const enabled =
    scope === "personal" ||
    (scope === "workspace" && !!workspaceId) ||
    (scope === "project" && !!workspaceId && !!projectId);

  return useQuery({
    queryKey: contentKeys.tree(scope, workspaceId || undefined, projectId || undefined),
    queryFn: () =>
      contentLib.getContentTree(
        scope,
        workspaceId || undefined,
        projectId || undefined
      ),
    enabled,
  });
}

/**
 * Hook to create a folder in the content tree
 */
export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      folderPath,
      workspaceId,
      projectId,
    }: {
      scope: ContentScope;
      folderPath: string;
      workspaceId?: string;
      projectId?: string;
    }) => contentLib.createFolder(scope, folderPath, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId
        ),
      });
    },
  });
}

/**
 * Hook to rename a folder in the content tree
 */
export function useRenameFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      oldPath,
      newName,
      workspaceId,
      projectId,
    }: {
      scope: ContentScope;
      oldPath: string;
      newName: string;
      workspaceId?: string;
      projectId?: string;
    }) => contentLib.renameFolder(scope, oldPath, newName, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId
        ),
      });
    },
  });
}

/**
 * Hook to delete a folder from the content tree
 */
export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      folderPath,
      workspaceId,
      projectId,
    }: {
      scope: ContentScope;
      folderPath: string;
      workspaceId?: string;
      projectId?: string;
    }) => contentLib.deleteFolder(scope, folderPath, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId
        ),
      });
    },
  });
}

/**
 * Hook to move a doc between folders (within same scope)
 */
export function useMoveDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      docId,
      fromPath,
      toPath,
      workspaceId,
      projectId,
    }: {
      scope: ContentScope;
      docId: string;
      fromPath: string;
      toPath: string;
      workspaceId?: string;
      projectId?: string;
    }) => contentLib.moveDoc(scope, docId, fromPath, toPath, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId
        ),
      });
    },
  });
}

/**
 * Hook to create a doc in a specific folder
 */
export function useCreateDocInFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      scope: ContentScope;
      title: string;
      content?: string;
      folderPath?: string;
      workspaceId?: string;
      projectId?: string;
    }) => contentLib.createDocInFolder(data),
    onSuccess: (_newDoc, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId
        ),
      });
      // Also invalidate the flat list queries for backward compatibility
      if (variables.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: contentKeys.byWorkspace(variables.workspaceId),
        });
      }
    },
  });
}

/**
 * Hook to import files (docs and assets)
 * - Markdown files are imported as editable docs
 * - Other files are copied as assets (binary)
 */
export function useImportFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      files,
      scope,
      folderPath,
      workspaceId,
      projectId,
    }: {
      files: Array<{ name: string; content: string | Uint8Array }>;
      scope: ContentScope;
      folderPath?: string;
      workspaceId?: string;
      projectId?: string;
    }) => contentLib.importFiles(files, scope, folderPath, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId
        ),
      });
      // Also invalidate the flat list queries
      if (variables.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: contentKeys.byWorkspace(variables.workspaceId),
        });
      }
    },
  });
}

// ============================================================================
// Folder AI Inclusion hooks
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import { getFolderAIInclusion, setFolderAIInclusion } from "@/lib/rag/aiignore";
import { PERSONAL_WORKSPACE_ID } from "@/lib/desk/constants";
import { isTauri } from "@/lib/desk/tauri-fs";

/**
 * Convert a content-relative folder path to a workspace-relative path.
 * Content tree uses paths relative to the content base (e.g., "drafts"),
 * but .aiignore stores paths relative to workspace root (e.g., "projects/website/docs/drafts").
 */
function toWorkspaceRelativePath(
  contentRelativePath: string,
  scope: ContentScope,
  projectId?: string
): string {
  // Personal and workspace scopes: content is directly under docs/
  if (scope === "personal" || scope === "workspace") {
    return `docs/${contentRelativePath}`;
  }
  // Project scope: content is under projects/{projectId}/docs/
  if (projectId) {
    return `projects/${projectId}/docs/${contentRelativePath}`;
  }
  // Fallback (shouldn't happen if used correctly)
  return contentRelativePath;
}

/**
 * Hook to manage AI inclusion states for folders in a content tree
 *
 * @param folderPaths - Array of folder paths to track (content-relative)
 * @param workspaceId - The workspace ID (required for non-personal scopes)
 * @param scope - The content scope
 * @param projectId - The project ID (required for project scope)
 * @returns Object with folderAIStates map and toggleFolderAI function
 */
export function useFolderAIStates(
  folderPaths: string[],
  workspaceId: string | null | undefined,
  scope: ContentScope,
  projectId?: string | null
) {
  const [folderAIStates, setFolderAIStates] = useState<Map<string, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Determine the effective workspace ID
  const effectiveWorkspaceId = workspaceId || (scope === "personal" ? PERSONAL_WORKSPACE_ID : null);

  // Load AI states for all folders when folder paths or workspace changes
  useEffect(() => {
    if (!effectiveWorkspaceId || !isTauri() || folderPaths.length === 0) {
      // In browser mode or without workspace, default all to included
      const defaultStates = new Map<string, boolean>();
      folderPaths.forEach(path => defaultStates.set(path, true));
      setFolderAIStates(defaultStates);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    async function loadStates() {
      const states = new Map<string, boolean>();

      await Promise.all(
        folderPaths.map(async (contentPath) => {
          try {
            // Convert to workspace-relative path for .aiignore lookup
            const wsRelativePath = toWorkspaceRelativePath(contentPath, scope, projectId || undefined);
            const isIncluded = await getFolderAIInclusion(wsRelativePath, effectiveWorkspaceId!);
            if (!cancelled) {
              // Store state keyed by the original content-relative path (for UI)
              states.set(contentPath, isIncluded);
            }
          } catch (error) {
            console.error(`Failed to get AI inclusion for folder ${contentPath}:`, error);
            states.set(contentPath, true); // Default to included on error
          }
        })
      );

      if (!cancelled) {
        setFolderAIStates(states);
        setIsLoading(false);
      }
    }

    loadStates();

    return () => {
      cancelled = true;
    };
  }, [folderPaths.join(","), effectiveWorkspaceId, scope, projectId]);

  // Toggle AI inclusion for a folder
  const toggleFolderAI = useCallback(
    async (folderPath: string, currentlyIncluded: boolean) => {
      if (!effectiveWorkspaceId) return;

      // Convert to workspace-relative path for .aiignore storage
      const wsRelativePath = toWorkspaceRelativePath(folderPath, scope, projectId || undefined);

      try {
        // Optimistically update state (keyed by original content path)
        setFolderAIStates((prev) => {
          const next = new Map(prev);
          next.set(folderPath, !currentlyIncluded);
          return next;
        });

        // Persist the change using workspace-relative path
        await setFolderAIInclusion(wsRelativePath, effectiveWorkspaceId, !currentlyIncluded);
      } catch (error) {
        console.error(`Failed to toggle AI inclusion for folder ${folderPath}:`, error);
        // Revert on error
        setFolderAIStates((prev) => {
          const next = new Map(prev);
          next.set(folderPath, currentlyIncluded);
          return next;
        });
      }
    },
    [effectiveWorkspaceId, scope, projectId]
  );

  return {
    folderAIStates,
    toggleFolderAI,
    isLoading,
  };
}
