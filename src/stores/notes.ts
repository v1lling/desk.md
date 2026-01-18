import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Note } from "@/types";
import * as noteLib from "@/lib/orbit/notes";

// Query keys
export const noteKeys = {
  all: ["notes"] as const,
  byArea: (areaId: string) => [...noteKeys.all, "area", areaId] as const,
  byProject: (areaId: string, projectId: string) =>
    [...noteKeys.byArea(areaId), "project", projectId] as const,
  detail: (areaId: string, noteId: string) =>
    [...noteKeys.byArea(areaId), "detail", noteId] as const,
};

/**
 * Hook to fetch all notes for an area
 */
export function useNotes(areaId: string | null) {
  return useQuery({
    queryKey: noteKeys.byArea(areaId || ""),
    queryFn: () => noteLib.getNotes(areaId!),
    enabled: !!areaId,
  });
}

/**
 * Hook to fetch notes for a specific project
 */
export function useProjectNotes(areaId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: noteKeys.byProject(areaId || "", projectId || ""),
    queryFn: () => noteLib.getNotesByProject(areaId!, projectId!),
    enabled: !!areaId && !!projectId,
  });
}

/**
 * Hook to fetch a single note
 */
export function useNote(areaId: string | null, noteId: string | null) {
  return useQuery({
    queryKey: noteKeys.detail(areaId || "", noteId || ""),
    queryFn: () => noteLib.getNote(areaId!, noteId!),
    enabled: !!areaId && !!noteId,
  });
}

/**
 * Hook to create a new note
 */
export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      areaId: string;
      projectId: string;
      title: string;
      content?: string;
    }) => noteLib.createNote(data),
    onSuccess: (newNote) => {
      queryClient.invalidateQueries({
        queryKey: noteKeys.byArea(newNote.areaId),
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
      areaId,
      projectId,
      updates,
    }: {
      noteId: string;
      areaId: string;
      projectId: string;
      updates: Partial<Pick<Note, "title" | "content">>;
    }) => noteLib.updateNote(noteId, updates, areaId, projectId),
    onSuccess: (updatedNote, variables) => {
      if (updatedNote) {
        queryClient.invalidateQueries({
          queryKey: noteKeys.byArea(updatedNote.areaId),
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: noteKeys.byArea(variables.areaId),
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
    mutationFn: ({ noteId, areaId, projectId }: { noteId: string; areaId: string; projectId: string }) =>
      noteLib.deleteNote(noteId, areaId, projectId).then((success) => ({ success, areaId })),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: noteKeys.byArea(result.areaId),
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
      areaId,
      fromProjectId,
      toProjectId,
    }: {
      noteId: string;
      areaId: string;
      fromProjectId: string;
      toProjectId: string;
    }) => noteLib.moveNoteToProject(noteId, areaId, fromProjectId, toProjectId),
    onSuccess: (_result, variables) => {
      // Invalidate area notes to refresh the lists
      queryClient.invalidateQueries({
        queryKey: noteKeys.byArea(variables.areaId),
      });
    },
  });
}
