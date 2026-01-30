import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Doc, ContentScope, Asset } from "@/types";
import * as contentLib from "@/lib/orbit/content";

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
        // Invalidate all doc queries since we support multiple scopes
        queryClient.invalidateQueries({ queryKey: contentKeys.all });
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
    onSuccess: (success) => {
      if (success) {
        // Invalidate all doc queries since we support multiple scopes
        queryClient.invalidateQueries({ queryKey: contentKeys.all });
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
    onSuccess: (success) => {
      if (success) {
        // Invalidate all doc queries to refresh tree
        queryClient.invalidateQueries({ queryKey: contentKeys.all });
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
      // Invalidate workspace docs to refresh the lists
      queryClient.invalidateQueries({
        queryKey: contentKeys.byWorkspace(variables.workspaceId),
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
