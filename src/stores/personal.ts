import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task, TaskStatus, TaskPriority } from "@/types";
import * as personalLib from "@/lib/desk/personal";
import { PERSONAL_SPACE_ID } from "@/lib/desk/constants";

// Query keys
export const personalKeys = {
  all: ["personal"] as const,
  captureTasks: () => [...personalKeys.all, "capture"] as const,
  tasks: () => [...personalKeys.all, "tasks"] as const,
  allTasks: () => [...personalKeys.all, "allTasks"] as const,
  detail: (taskId: string) => [...personalKeys.all, "detail", taskId] as const,
};

// Re-export the personal space ID for convenience
export { PERSONAL_SPACE_ID };

// ============================================================================
// CAPTURE TASKS (Quick Capture)
// ============================================================================

/**
 * Hook to fetch capture tasks (quick capture for later triage)
 */
export function useCaptureTasks() {
  return useQuery({
    queryKey: personalKeys.captureTasks(),
    queryFn: () => personalLib.getCaptureTasks(),
  });
}

/**
 * Hook to create a capture task (quick capture)
 */
export function useCreateCaptureTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      priority?: TaskPriority;
      due?: string;
      content?: string;
    }) => personalLib.createPersonalTask({ ...data, isCapture: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalKeys.captureTasks() });
      queryClient.invalidateQueries({ queryKey: personalKeys.allTasks() });
    },
  });
}

/**
 * Hook to move task from capture to personal tasks (triage)
 */
export function useMoveFromCapture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => personalLib.moveFromCapture(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalKeys.captureTasks() });
      queryClient.invalidateQueries({ queryKey: personalKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: personalKeys.allTasks() });
    },
  });
}

/**
 * Hook to move task from capture to a workspace project
 */
export function useMoveCaptureToWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      workspaceId,
      projectId,
    }: {
      taskId: string;
      workspaceId: string;
      projectId: string;
    }) => personalLib.moveCaptureToWorkspace(taskId, workspaceId, projectId),
    onSuccess: (_data, variables) => {
      // Invalidate capture
      queryClient.invalidateQueries({ queryKey: personalKeys.captureTasks() });
      queryClient.invalidateQueries({ queryKey: personalKeys.allTasks() });
      // Invalidate target workspace tasks
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.workspaceId] });
      // Invalidate dashboard (active tasks, summaries)
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ============================================================================
// PERSONAL TASKS
// ============================================================================

/**
 * Hook to fetch personal tasks (not capture)
 */
export function usePersonalTasks() {
  return useQuery({
    queryKey: personalKeys.tasks(),
    queryFn: () => personalLib.getPersonalTasks(),
  });
}

/**
 * Hook to fetch all personal space tasks (capture + personal)
 */
export function useAllPersonalTasks() {
  return useQuery({
    queryKey: personalKeys.allTasks(),
    queryFn: () => personalLib.getAllPersonalTasks(),
  });
}

/**
 * Hook to fetch a single personal task by ID
 */
export function usePersonalTask(taskId: string | null) {
  return useQuery({
    queryKey: personalKeys.detail(taskId || ""),
    queryFn: async () => {
      if (!taskId) throw new Error("taskId is required");
      return personalLib.getPersonalTask(taskId);
    },
    enabled: !!taskId,
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
    }) => personalLib.createPersonalTask({ ...data, isCapture: false }),
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
    // No onSettled/invalidate - optimistic update is sufficient
    // Invalidating causes race condition with file write, causing snap-back
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
