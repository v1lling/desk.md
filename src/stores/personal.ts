import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task, Note, TaskStatus, TaskPriority } from "@/types";
import * as personalLib from "@/lib/orbit/personal";
import { PERSONAL_SPACE_ID } from "@/lib/orbit/constants";

// Query keys
export const personalKeys = {
  all: ["personal"] as const,
  inboxTasks: () => [...personalKeys.all, "inbox"] as const,
  tasks: () => [...personalKeys.all, "tasks"] as const,
  allTasks: () => [...personalKeys.all, "allTasks"] as const,
  notes: () => [...personalKeys.all, "notes"] as const,
  note: (noteId: string) => [...personalKeys.notes(), noteId] as const,
};

// Re-export the personal space ID for convenience
export { PERSONAL_SPACE_ID };

// ============================================================================
// INBOX TASKS
// ============================================================================

/**
 * Hook to fetch inbox tasks (quick capture)
 */
export function useInboxTasks() {
  return useQuery({
    queryKey: personalKeys.inboxTasks(),
    queryFn: () => personalLib.getInboxTasks(),
  });
}

/**
 * Hook to create an inbox task (quick capture)
 */
export function useCreateInboxTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      priority?: TaskPriority;
      due?: string;
      content?: string;
    }) => personalLib.createPersonalTask({ ...data, isInbox: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalKeys.inboxTasks() });
      queryClient.invalidateQueries({ queryKey: personalKeys.allTasks() });
    },
  });
}

/**
 * Hook to move task from inbox to personal tasks (triage)
 */
export function useMoveFromInbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => personalLib.moveFromInbox(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalKeys.inboxTasks() });
      queryClient.invalidateQueries({ queryKey: personalKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: personalKeys.allTasks() });
    },
  });
}

// ============================================================================
// PERSONAL TASKS
// ============================================================================

/**
 * Hook to fetch personal tasks (not inbox)
 */
export function usePersonalTasks() {
  return useQuery({
    queryKey: personalKeys.tasks(),
    queryFn: () => personalLib.getPersonalTasks(),
  });
}

/**
 * Hook to fetch all personal space tasks (inbox + personal)
 */
export function useAllPersonalTasks() {
  return useQuery({
    queryKey: personalKeys.allTasks(),
    queryFn: () => personalLib.getAllPersonalTasks(),
  });
}

/**
 * Hook to create a personal task
 */
export function useCreatePersonalTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      priority?: TaskPriority;
      due?: string;
      content?: string;
    }) => personalLib.createPersonalTask({ ...data, isInbox: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: personalKeys.allTasks() });
    },
  });
}

/**
 * Hook to update a personal task
 */
export function useUpdatePersonalTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      updates,
    }: {
      taskId: string;
      updates: Partial<Pick<Task, "title" | "status" | "priority" | "due" | "content">>;
    }) => personalLib.updatePersonalTask(taskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalKeys.all });
    },
  });
}

/**
 * Hook to delete a personal task
 */
export function useDeletePersonalTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => personalLib.deletePersonalTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalKeys.all });
    },
  });
}

/**
 * Hook to move a personal task's status (for drag-drop)
 */
export function useMovePersonalTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, newStatus }: { taskId: string; newStatus: TaskStatus }) =>
      personalLib.updatePersonalTask(taskId, { status: newStatus }),
    onMutate: async ({ taskId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: personalKeys.all });

      const previousTasks = queryClient.getQueriesData({ queryKey: personalKeys.all });

      // Optimistically update
      queryClient.setQueriesData(
        { queryKey: personalKeys.all },
        (old: Task[] | undefined) => {
          if (!old) return old;
          return old.map((task) =>
            task.id === taskId ? { ...task, status: newStatus } : task
          );
        }
      );

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        context.previousTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: personalKeys.all });
    },
  });
}

// ============================================================================
// PERSONAL NOTES
// ============================================================================

/**
 * Hook to fetch all personal notes
 */
export function usePersonalNotes() {
  return useQuery({
    queryKey: personalKeys.notes(),
    queryFn: () => personalLib.getPersonalNotes(),
  });
}

/**
 * Hook to fetch a single personal note
 */
export function usePersonalNote(noteId: string | null) {
  return useQuery({
    queryKey: personalKeys.note(noteId || ""),
    queryFn: () => personalLib.getPersonalNote(noteId!),
    enabled: !!noteId,
  });
}

/**
 * Hook to create a personal note
 */
export function useCreatePersonalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; content?: string }) =>
      personalLib.createPersonalNote(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalKeys.notes() });
    },
  });
}

/**
 * Hook to update a personal note
 */
export function useUpdatePersonalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noteId,
      updates,
    }: {
      noteId: string;
      updates: Partial<Pick<Note, "title" | "content">>;
    }) => personalLib.updatePersonalNote(noteId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalKeys.notes() });
    },
  });
}

/**
 * Hook to delete a personal note
 */
export function useDeletePersonalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => personalLib.deletePersonalNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalKeys.notes() });
    },
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Helper to group personal tasks by status
 */
export function groupPersonalTasksByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  return {
    todo: tasks.filter((t) => t.status === "todo"),
    doing: tasks.filter((t) => t.status === "doing"),
    waiting: tasks.filter((t) => t.status === "waiting"),
    done: tasks.filter((t) => t.status === "done"),
  };
}

/**
 * Check if we're in personal space context
 */
export function isPersonalSpace(workspaceId: string | null): boolean {
  return workspaceId === PERSONAL_SPACE_ID;
}
