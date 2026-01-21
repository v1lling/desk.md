import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Doc } from "@/types";
import * as docLib from "@/lib/orbit/docs";

// Query keys
export const docKeys = {
  all: ["docs"] as const,
  byWorkspace: (workspaceId: string) => [...docKeys.all, "workspace", workspaceId] as const,
  byProject: (workspaceId: string, projectId: string) =>
    [...docKeys.byWorkspace(workspaceId), "project", projectId] as const,
  detail: (workspaceId: string, docId: string) =>
    [...docKeys.byWorkspace(workspaceId), "detail", docId] as const,
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
