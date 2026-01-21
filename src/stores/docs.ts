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

// Keep old key names as aliases for backwards compatibility
export const noteKeys = docKeys;

/**
 * Hook to fetch all docs for a workspace
 */
export function useDocs(workspaceId: string | null) {
  return useQuery({
    queryKey: docKeys.byWorkspace(workspaceId || ""),
    queryFn: () => docLib.getDocs(workspaceId!),
    enabled: !!workspaceId,
  });
}

// Alias for backwards compatibility
export const useNotes = useDocs;

/**
 * Hook to fetch docs for a specific project
 */
export function useProjectDocs(workspaceId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: docKeys.byProject(workspaceId || "", projectId || ""),
    queryFn: () => docLib.getDocsByProject(workspaceId!, projectId!),
    enabled: !!workspaceId && !!projectId,
  });
}

// Alias for backwards compatibility
export const useProjectNotes = useProjectDocs;

/**
 * Hook to fetch a single doc
 */
export function useDoc(workspaceId: string | null, docId: string | null) {
  return useQuery({
    queryKey: docKeys.detail(workspaceId || "", docId || ""),
    queryFn: () => docLib.getDoc(workspaceId!, docId!),
    enabled: !!workspaceId && !!docId,
  });
}

// Alias for backwards compatibility
export const useNote = useDoc;

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

// Alias for backwards compatibility
export const useCreateNote = useCreateDoc;

/**
 * Hook to update a doc
 */
export function useUpdateDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      docId,
      workspaceId,
      projectId,
      updates,
    }: {
      docId: string;
      workspaceId: string;
      projectId: string;
      updates: Partial<Pick<Doc, "title" | "content">>;
    }) => docLib.updateDoc(docId, updates, workspaceId, projectId),
    onSuccess: (updatedDoc, variables) => {
      if (updatedDoc) {
        queryClient.invalidateQueries({
          queryKey: docKeys.byWorkspace(updatedDoc.workspaceId),
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: docKeys.byWorkspace(variables.workspaceId),
        });
      }
    },
  });
}

// Alias for backwards compatibility
export const useUpdateNote = useUpdateDoc;

/**
 * Hook to delete a doc
 */
export function useDeleteDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ docId, workspaceId, projectId }: { docId: string; workspaceId: string; projectId: string }) =>
      docLib.deleteDoc(docId, workspaceId, projectId).then((success) => ({ success, workspaceId })),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: docKeys.byWorkspace(result.workspaceId),
        });
      }
    },
  });
}

// Alias for backwards compatibility
export const useDeleteNote = useDeleteDoc;

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

// Alias for backwards compatibility
export const useMoveNoteToProject = useMoveDocToProject;

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
    onSuccess: (newDoc, variables) => {
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
