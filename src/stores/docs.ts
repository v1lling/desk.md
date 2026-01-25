import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Doc, DocScope } from "@/types";
import * as docLib from "@/lib/orbit/docs";

// Query keys
export const docKeys = {
  all: ["docs"] as const,
  byWorkspace: (workspaceId: string) => [...docKeys.all, "workspace", workspaceId] as const,
  byProject: (workspaceId: string, projectId: string) =>
    [...docKeys.byWorkspace(workspaceId), "project", projectId] as const,
  detail: (workspaceId: string, docId: string) =>
    [...docKeys.byWorkspace(workspaceId), "detail", docId] as const,
  // Tree keys for scoped doc trees
  tree: (scope: DocScope, workspaceId?: string, projectId?: string) =>
    [...docKeys.all, "tree", scope, workspaceId || "", projectId || ""] as const,
};

/**
 * Hook to fetch all docs for a workspace
 */
export function useDocs(workspaceId: string | null) {
  return useQuery({
    queryKey: docKeys.byWorkspace(workspaceId || ""),
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return docLib.getDocs(workspaceId);
    },
    enabled: !!workspaceId,
  });
}

/**
 * Hook to fetch docs for a specific project
 */
export function useProjectDocs(workspaceId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: docKeys.byProject(workspaceId || "", projectId || ""),
    queryFn: async () => {
      if (!workspaceId || !projectId) throw new Error("workspaceId and projectId are required");
      return docLib.getDocsByProject(workspaceId, projectId);
    },
    enabled: !!workspaceId && !!projectId,
  });
}

/**
 * Hook to fetch a single doc
 */
export function useDoc(workspaceId: string | null, docId: string | null) {
  return useQuery({
    queryKey: docKeys.detail(workspaceId || "", docId || ""),
    queryFn: async () => {
      if (!workspaceId || !docId) throw new Error("workspaceId and docId are required");
      return docLib.getDoc(workspaceId, docId);
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
    }) => docLib.createDoc(data),
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({
        queryKey: docKeys.byWorkspace(newDoc.workspaceId),
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
    }) => docLib.updateDoc(doc, updates),
    onSuccess: (updatedDoc) => {
      if (updatedDoc) {
        // Invalidate all doc queries since we support multiple scopes
        queryClient.invalidateQueries({ queryKey: docKeys.all });
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
    mutationFn: (doc: Doc) => docLib.deleteDoc(doc),
    onSuccess: (success) => {
      if (success) {
        // Invalidate all doc queries since we support multiple scopes
        queryClient.invalidateQueries({ queryKey: docKeys.all });
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
    }) => docLib.moveDocToProject(docId, workspaceId, fromProjectId, toProjectId),
    onSuccess: (_result, variables) => {
      // Invalidate workspace docs to refresh the lists
      queryClient.invalidateQueries({
        queryKey: docKeys.byWorkspace(variables.workspaceId),
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
    queryKey: [...docKeys.byWorkspace(workspaceId || ""), "all-recursive"] as const,
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return docLib.getAllDocsForWorkspace(workspaceId);
    },
    enabled: !!workspaceId,
  });
}

// ============================================================================
// Tree-based hooks for scoped doc trees
// ============================================================================

/**
 * Hook to fetch a doc tree for a given scope
 */
export function useDocTree(
  scope: DocScope,
  workspaceId?: string | null,
  projectId?: string | null
) {
  const enabled =
    scope === "personal" ||
    (scope === "workspace" && !!workspaceId) ||
    (scope === "project" && !!workspaceId && !!projectId);

  return useQuery({
    queryKey: docKeys.tree(scope, workspaceId || undefined, projectId || undefined),
    queryFn: () =>
      docLib.getDocTree(
        scope,
        workspaceId || undefined,
        projectId || undefined
      ),
    enabled,
  });
}

/**
 * Hook to create a folder in the doc tree
 */
export function useCreateDocFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      folderPath,
      workspaceId,
      projectId,
    }: {
      scope: DocScope;
      folderPath: string;
      workspaceId?: string;
      projectId?: string;
    }) => docLib.createDocFolder(scope, folderPath, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: docKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId
        ),
      });
    },
  });
}

/**
 * Hook to rename a folder in the doc tree
 */
export function useRenameDocFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      oldPath,
      newName,
      workspaceId,
      projectId,
    }: {
      scope: DocScope;
      oldPath: string;
      newName: string;
      workspaceId?: string;
      projectId?: string;
    }) => docLib.renameDocFolder(scope, oldPath, newName, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: docKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId
        ),
      });
    },
  });
}

/**
 * Hook to delete a folder from the doc tree
 */
export function useDeleteDocFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      folderPath,
      workspaceId,
      projectId,
    }: {
      scope: DocScope;
      folderPath: string;
      workspaceId?: string;
      projectId?: string;
    }) => docLib.deleteDocFolder(scope, folderPath, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: docKeys.tree(
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
      scope: DocScope;
      docId: string;
      fromPath: string;
      toPath: string;
      workspaceId?: string;
      projectId?: string;
    }) => docLib.moveDoc(scope, docId, fromPath, toPath, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: docKeys.tree(
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
      scope: DocScope;
      title: string;
      content?: string;
      folderPath?: string;
      workspaceId?: string;
      projectId?: string;
    }) => docLib.createDocInFolder(data),
    onSuccess: (_newDoc, variables) => {
      queryClient.invalidateQueries({
        queryKey: docKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId
        ),
      });
      // Also invalidate the flat list queries for backward compatibility
      if (variables.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: docKeys.byWorkspace(variables.workspaceId),
        });
      }
    },
  });
}

/**
 * Hook to import multiple docs from file contents
 */
export function useImportDocs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      files,
      scope,
      folderPath,
      workspaceId,
      projectId,
    }: {
      files: Array<{ name: string; content: string }>;
      scope: DocScope;
      folderPath?: string;
      workspaceId?: string;
      projectId?: string;
    }) => docLib.importDocs(files, scope, folderPath, workspaceId, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: docKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId
        ),
      });
      // Also invalidate the flat list queries
      if (variables.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: docKeys.byWorkspace(variables.workspaceId),
        });
      }
    },
  });
}
