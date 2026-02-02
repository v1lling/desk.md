import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task, TaskStatus, TaskPriority } from "@/types";
import * as taskLib from "@/lib/desk/tasks";

// Query keys
export const taskKeys = {
  all: ["tasks"] as const,
  byWorkspace: (workspaceId: string) => [...taskKeys.all, "workspace", workspaceId] as const,
  byProject: (workspaceId: string, projectId: string) =>
    [...taskKeys.byWorkspace(workspaceId), "project", projectId] as const,
  detail: (workspaceId: string, taskId: string) =>
    [...taskKeys.byWorkspace(workspaceId), "detail", taskId] as const,
};

/**
 * Hook to fetch all tasks for a workspace
 */
export function useTasks(workspaceId: string | null) {
  return useQuery({
    queryKey: taskKeys.byWorkspace(workspaceId || ""),
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return taskLib.getTasks(workspaceId);
    },
    enabled: !!workspaceId,
  });
}

/**
 * Hook to fetch tasks for a specific project
 */
export function useProjectTasks(workspaceId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: taskKeys.byProject(workspaceId || "", projectId || ""),
    queryFn: async () => {
      if (!workspaceId || !projectId) throw new Error("workspaceId and projectId are required");
      return taskLib.getTasksByProject(workspaceId, projectId);
    },
    enabled: !!workspaceId && !!projectId,
  });
}

/**
 * Hook to fetch a single task
 * Works for all workspaces including Personal (_personal)
 */
export function useTask(workspaceId: string | null, taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(workspaceId || "", taskId || ""),
    queryFn: async () => {
      if (!workspaceId || !taskId) throw new Error("workspaceId and taskId are required");
      return taskLib.getTask(workspaceId, taskId);
    },
    enabled: !!workspaceId && !!taskId,
  });
}

/**
 * Hook to create a new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      workspaceId: string;
      projectId: string;
      title: string;
      priority?: TaskPriority;
      due?: string;
      content?: string;
    }) => taskLib.createTask(data),
    onSuccess: (newTask) => {
      // Invalidate and refetch tasks for the workspace
      queryClient.invalidateQueries({
        queryKey: taskKeys.byWorkspace(newTask.workspaceId),
      });
    },
  });
}

/**
 * Hook to update a task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      workspaceId,
      projectId,
      updates,
    }: {
      taskId: string;
      workspaceId: string;
      projectId: string;
      updates: Partial<Pick<Task, "title" | "status" | "priority" | "due" | "content" | "projectId">>;
    }) => taskLib.updateTask(taskId, updates, workspaceId, projectId),
    onSuccess: (updatedTask, variables) => {
      if (updatedTask) {
        // Invalidate both list and detail queries to keep editor in sync
        queryClient.invalidateQueries({
          queryKey: taskKeys.byWorkspace(updatedTask.workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: taskKeys.detail(updatedTask.workspaceId, updatedTask.id),
        });
      } else {
        // Fallback invalidation using passed workspaceId
        queryClient.invalidateQueries({
          queryKey: taskKeys.byWorkspace(variables.workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: taskKeys.detail(variables.workspaceId, variables.taskId),
        });
      }
    },
  });
}

/**
 * Hook to delete a task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, workspaceId, projectId }: { taskId: string; workspaceId: string; projectId: string }) =>
      taskLib.deleteTask(taskId, workspaceId, projectId).then((success) => ({ success, workspaceId })),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: taskKeys.byWorkspace(result.workspaceId),
        });
      }
    },
  });
}

/**
 * Hook to move a task to a different status (for drag-drop)
 */
export function useMoveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, newStatus, workspaceId, projectId }: { taskId: string; newStatus: TaskStatus; workspaceId?: string; projectId?: string }) =>
      taskLib.moveTask(taskId, newStatus, workspaceId, projectId),
    onMutate: async ({ taskId, newStatus }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.all });

      // Snapshot current state for rollback
      const previousTasks = queryClient.getQueriesData({ queryKey: taskKeys.all });

      // Optimistically update the task in all queries
      queryClient.setQueriesData(
        { queryKey: taskKeys.all },
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
      // Rollback on error
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

/**
 * Hook to move a task to a different project
 */
export function useMoveTaskToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      workspaceId,
      fromProjectId,
      toProjectId,
    }: {
      taskId: string;
      workspaceId: string;
      fromProjectId: string;
      toProjectId: string;
    }) => taskLib.moveTaskToProject(taskId, workspaceId, fromProjectId, toProjectId),
    onSuccess: (_result, variables) => {
      // Invalidate workspace tasks to refresh the lists
      queryClient.invalidateQueries({
        queryKey: taskKeys.byWorkspace(variables.workspaceId),
      });
    },
  });
}

/**
 * Helper to group tasks by status for Kanban view
 */
export function groupTasksByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  return {
    todo: tasks.filter((t) => t.status === "todo"),
    doing: tasks.filter((t) => t.status === "doing"),
    waiting: tasks.filter((t) => t.status === "waiting"),
    done: tasks.filter((t) => t.status === "done"),
  };
}
