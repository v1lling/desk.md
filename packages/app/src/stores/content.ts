import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Doc, ContentScope, Asset } from "@desk/core/types";
import { getDeskService } from "@desk/core";
import type { ConvertibleAction, DocLocation } from "@desk/core";

// Query keys for content (docs, assets, folders)
export const contentKeys = {
  all: ["content"] as const,
  byWorkspace: (workspaceId: string) => [...contentKeys.all, "workspace", workspaceId] as const,
  byProject: (workspaceId: string, projectId: string) =>
    [...contentKeys.byWorkspace(workspaceId), "project", projectId] as const,
  detail: (workspaceId: string, docId: string) =>
    [...contentKeys.byWorkspace(workspaceId), "detail", docId] as const,
  tree: (scope: ContentScope, workspaceId?: string, projectId?: string) =>
    [...contentKeys.all, "tree", scope, workspaceId || "", projectId || ""] as const,
  // Workspace docs shell (workspace content + project folders)
  shell: (workspaceId: string) =>
    [...contentKeys.byWorkspace(workspaceId), "docs-shell"] as const,
};

/**
 * Hook to fetch all docs for a workspace
 */
export function useDocs(workspaceId: string | null) {
  return useQuery({
    queryKey: contentKeys.byWorkspace(workspaceId || ""),
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return getDeskService().getDocs(workspaceId);
    },
    enabled: !!workspaceId,
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
      return getDeskService().getDoc(workspaceId, docId);
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
      templateBody?: string;
      author?: "ai";
    }) => getDeskService().createDoc(data),
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
    }) => getDeskService().updateDoc(doc, updates),
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
    mutationFn: (doc: Doc) => getDeskService().deleteDoc(doc),
    onSuccess: (success, doc) => {
      if (success) {
        // Invalidate workspace-scoped queries (prefix-covers project/detail/overview).
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
    mutationFn: (asset: Asset) => getDeskService().deleteAsset(asset),
    onSuccess: (success, asset) => {
      if (success) {
        // Invalidate workspace-scoped queries (prefix-covers project/detail/overview).
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

// ============================================================================
// Tree-based hooks for scoped content trees
// ============================================================================

/**
 * Hook to fetch a content tree for a given scope
 */
export function useContentTree(
  scope: ContentScope,
  workspaceId?: string | null,
  projectId?: string | null,
) {
  const enabled =
    scope === "personal" ||
    (scope === "workspace" && !!workspaceId) ||
    (scope === "project" && !!workspaceId && !!projectId);

  return useQuery({
    queryKey: contentKeys.tree(scope, workspaceId || undefined, projectId || undefined),
    queryFn: () =>
      getDeskService().getContentTree(
        scope,
        workspaceId || undefined,
        projectId || undefined,
      ),
    enabled,
  });
}

/**
 * Hook to fetch workspace overview shell (workspace content + project folder stubs).
 * Project content is loaded lazily via useContentTree when folders are expanded.
 */
export function useWorkspaceDocsShell(workspaceId?: string | null) {
  return useQuery({
    queryKey: contentKeys.shell(workspaceId || ""),
    queryFn: () => getDeskService().getWorkspaceDocsShell(workspaceId!),
    enabled: !!workspaceId,
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
    }) => getDeskService().createFolder(scope, folderPath, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
        ),
      });
      if (variables.workspaceId) {
        queryClient.invalidateQueries({ queryKey: contentKeys.shell(variables.workspaceId) });
      }
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
    }) => getDeskService().renameFolder(scope, oldPath, newName, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
        ),
      });
      if (variables.workspaceId) {
        queryClient.invalidateQueries({ queryKey: contentKeys.shell(variables.workspaceId) });
      }
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
    }) => getDeskService().deleteFolder(scope, folderPath, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
        ),
      });
      if (variables.workspaceId) {
        queryClient.invalidateQueries({ queryKey: contentKeys.shell(variables.workspaceId) });
      }
    },
  });
}

/**
 * Hook to move a folder to a new parent folder
 */
export function useMoveFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      fromPath,
      toParentPath,
      workspaceId,
      projectId,
    }: {
      scope: ContentScope;
      fromPath: string;
      toParentPath: string;
      workspaceId?: string;
      projectId?: string;
    }) => getDeskService().moveFolder(scope, fromPath, toParentPath, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
        ),
      });
      if (variables.workspaceId) {
        queryClient.invalidateQueries({ queryKey: contentKeys.shell(variables.workspaceId) });
      }
    },
  });
}

/**
 * Hook to move a doc between folders, projects, and workspace scope.
 */
export function useMoveDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      docId,
      workspaceId,
      from,
      to,
    }: {
      docId: string;
      workspaceId: string;
      from: DocLocation;
      to: DocLocation;
    }) => getDeskService().moveDoc(docId, workspaceId, from, to),
    onSuccess: (_result, variables) => {
      const { workspaceId, from, to } = variables;
      // Invalidate both source and destination trees.
      for (const loc of [from, to]) {
        queryClient.invalidateQueries({
          queryKey: contentKeys.tree(loc.scope, workspaceId, loc.projectId),
        });
      }
      queryClient.invalidateQueries({ queryKey: contentKeys.shell(workspaceId) });
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
      templateBody?: string;
      folderPath?: string;
      workspaceId?: string;
      projectId?: string;
    }) => getDeskService().createDocInFolder(data),
    onSuccess: (_newDoc, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
        ),
      });
      if (variables.workspaceId) {
        queryClient.invalidateQueries({ queryKey: contentKeys.shell(variables.workspaceId) });
      }
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
      convertibleAction = "keep",
    }: {
      files: Array<{ name: string; content: string | Uint8Array }>;
      scope: ContentScope;
      folderPath?: string;
      workspaceId?: string;
      projectId?: string;
      convertibleAction?: ConvertibleAction;
    }) =>
      getDeskService().importFiles(
        files,
        scope,
        folderPath,
        workspaceId,
        projectId,
        convertibleAction,
      ),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
        ),
      });
      if (variables.workspaceId) {
        queryClient.invalidateQueries({ queryKey: contentKeys.shell(variables.workspaceId) });
      }
      // Also invalidate the flat list queries
      if (variables.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: contentKeys.byWorkspace(variables.workspaceId),
        });
      }
    },
  });
}

// Folder AI inclusion hook — re-exported for backwards compatibility
// Canonical location: src/hooks/use-folder-ai-states.ts
export { useFolderAIStates } from "@/hooks/use-folder-ai-states";
