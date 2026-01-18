import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task, TaskStatus, TaskPriority } from "@/types";
import * as taskLib from "@/lib/orbit/tasks";

// Query keys
export const taskKeys = {
  all: ["tasks"] as const,
  byArea: (areaId: string) => [...taskKeys.all, "area", areaId] as const,
  byProject: (areaId: string, projectId: string) =>
    [...taskKeys.byArea(areaId), "project", projectId] as const,
  detail: (areaId: string, taskId: string) =>
    [...taskKeys.byArea(areaId), "detail", taskId] as const,
};

/**
 * Hook to fetch all tasks for an area
 */
export function useTasks(areaId: string | null) {
  return useQuery({
    queryKey: taskKeys.byArea(areaId || ""),
    queryFn: () => taskLib.getTasks(areaId!),
    enabled: !!areaId,
  });
}

/**
 * Hook to fetch tasks for a specific project
 */
export function useProjectTasks(areaId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: taskKeys.byProject(areaId || "", projectId || ""),
    queryFn: () => taskLib.getTasksByProject(areaId!, projectId!),
    enabled: !!areaId && !!projectId,
  });
}

/**
 * Hook to fetch a single task
 */
export function useTask(areaId: string | null, taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(areaId || "", taskId || ""),
    queryFn: () => taskLib.getTask(areaId!, taskId!),
    enabled: !!areaId && !!taskId,
  });
}

/**
 * Hook to create a new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      areaId: string;
      projectId: string;
      title: string;
      priority?: TaskPriority;
      due?: string;
      content?: string;
    }) => taskLib.createTask(data),
    onSuccess: (newTask) => {
      // Invalidate and refetch tasks for the area
      queryClient.invalidateQueries({
        queryKey: taskKeys.byArea(newTask.areaId),
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
      areaId,
      projectId,
      updates,
    }: {
      taskId: string;
      areaId: string;
      projectId: string;
      updates: Partial<Pick<Task, "title" | "status" | "priority" | "due" | "content" | "projectId">>;
    }) => taskLib.updateTask(taskId, updates, areaId, projectId),
    onSuccess: (updatedTask, variables) => {
      if (updatedTask) {
        queryClient.invalidateQueries({
          queryKey: taskKeys.byArea(updatedTask.areaId),
        });
      } else {
        // Fallback invalidation using passed areaId
        queryClient.invalidateQueries({
          queryKey: taskKeys.byArea(variables.areaId),
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
    mutationFn: ({ taskId, areaId, projectId }: { taskId: string; areaId: string; projectId: string }) =>
      taskLib.deleteTask(taskId, areaId, projectId).then((success) => ({ success, areaId })),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: taskKeys.byArea(result.areaId),
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
    mutationFn: ({ taskId, newStatus, areaId, projectId }: { taskId: string; newStatus: TaskStatus; areaId?: string; projectId?: string }) =>
      taskLib.moveTask(taskId, newStatus, areaId, projectId),
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
    onSettled: (_data, _error, variables) => {
      // Always refetch after mutation settles
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
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
