import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Note } from "@/types";
import * as noteLib from "@/lib/orbit/notes";

// Query keys
export const noteKeys = {
  all: ["notes"] as const,
  byWorkspace: (workspaceId: string) => [...noteKeys.all, "workspace", workspaceId] as const,
  byProject: (workspaceId: string, projectId: string) =>
    [...noteKeys.byWorkspace(workspaceId), "project", projectId] as const,
  detail: (workspaceId: string, noteId: string) =>
    [...noteKeys.byWorkspace(workspaceId), "detail", noteId] as const,
};

/**
 * Hook to fetch all notes for a workspace
 */
export function useNotes(workspaceId: string | null) {
  return useQuery({
    queryKey: noteKeys.byWorkspace(workspaceId || ""),
    queryFn: () => noteLib.getNotes(workspaceId!),
    enabled: !!workspaceId,
  });
}

/**
 * Hook to fetch notes for a specific project
 */
export function useProjectNotes(workspaceId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: noteKeys.byProject(workspaceId || "", projectId || ""),
    queryFn: () => noteLib.getNotesByProject(workspaceId!, projectId!),
    enabled: !!workspaceId && !!projectId,
  });
}

/**
 * Hook to fetch a single note
 */
export function useNote(workspaceId: string | null, noteId: string | null) {
  return useQuery({
    queryKey: noteKeys.detail(workspaceId || "", noteId || ""),
    queryFn: () => noteLib.getNote(workspaceId!, noteId!),
    enabled: !!workspaceId && !!noteId,
  });
}

/**
 * Hook to create a new note
 */
export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      workspaceId: string;
      projectId: string;
      title: string;
      content?: string;
    }) => noteLib.createNote(data),
    onSuccess: (newNote) => {
      queryClient.invalidateQueries({
        queryKey: noteKeys.byWorkspace(newNote.workspaceId),
      });
    },
  });
}

/**
 * Hook to update a note
 */
export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noteId,
      workspaceId,
      projectId,
      updates,
    }: {
      noteId: string;
      workspaceId: string;
      projectId: string;
      updates: Partial<Pick<Note, "title" | "content">>;
    }) => noteLib.updateNote(noteId, updates, workspaceId, projectId),
    onSuccess: (updatedNote, variables) => {
      if (updatedNote) {
        queryClient.invalidateQueries({
          queryKey: noteKeys.byWorkspace(updatedNote.workspaceId),
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: noteKeys.byWorkspace(variables.workspaceId),
        });
      }
    },
  });
}

/**
 * Hook to delete a note
 */
export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, workspaceId, projectId }: { noteId: string; workspaceId: string; projectId: string }) =>
      noteLib.deleteNote(noteId, workspaceId, projectId).then((success) => ({ success, workspaceId })),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: noteKeys.byWorkspace(result.workspaceId),
        });
      }
    },
  });
}

/**
 * Hook to move a note to a different project
 */
export function useMoveNoteToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noteId,
      workspaceId,
      fromProjectId,
      toProjectId,
    }: {
      noteId: string;
      workspaceId: string;
      fromProjectId: string;
      toProjectId: string;
    }) => noteLib.moveNoteToProject(noteId, workspaceId, fromProjectId, toProjectId),
    onSuccess: (_result, variables) => {
      // Invalidate workspace notes to refresh the lists
      queryClient.invalidateQueries({
        queryKey: noteKeys.byWorkspace(variables.workspaceId),
      });
    },
  });
}
