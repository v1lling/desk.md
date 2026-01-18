import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskStatus, ProjectViewState } from "@/types";
import * as viewStateLib from "@/lib/orbit/view-state";

// Query keys
export const viewStateKeys = {
  all: ["viewState"] as const,
  byProject: (areaId: string, projectId: string) =>
    [...viewStateKeys.all, areaId, projectId] as const,
};

/**
 * Hook to fetch view state for a project
 */
export function useViewState(areaId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: viewStateKeys.byProject(areaId || "", projectId || ""),
    queryFn: () => viewStateLib.getViewState(areaId!, projectId!),
    enabled: !!areaId && !!projectId,
    staleTime: 0, // Always fetch fresh
  });
}

/**
 * Hook to update task order in view state
 */
export function useUpdateTaskOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      areaId,
      projectId,
      taskOrder,
    }: {
      areaId: string;
      projectId: string;
      taskOrder: Record<TaskStatus, string[]>;
    }) => viewStateLib.updateTaskOrder(areaId, projectId, taskOrder),
    onMutate: async ({ areaId, projectId, taskOrder }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: viewStateKeys.byProject(areaId, projectId),
      });

      // Snapshot previous state
      const previousState = queryClient.getQueryData<ProjectViewState>(
        viewStateKeys.byProject(areaId, projectId)
      );

      // Optimistically update
      queryClient.setQueryData<ProjectViewState>(
        viewStateKeys.byProject(areaId, projectId),
        (old) => ({
          ...old,
          taskOrder,
        })
      );

      return { previousState, areaId, projectId };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context) {
        queryClient.setQueryData(
          viewStateKeys.byProject(context.areaId, context.projectId),
          context.previousState
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      // Refetch after mutation settles
      queryClient.invalidateQueries({
        queryKey: viewStateKeys.byProject(variables.areaId, variables.projectId),
      });
    },
  });
}

/**
 * Hook to remove a task from view state order (call when deleting task)
 */
export function useRemoveTaskFromOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      areaId,
      projectId,
      taskId,
    }: {
      areaId: string;
      projectId: string;
      taskId: string;
    }) => viewStateLib.removeTaskFromOrder(areaId, projectId, taskId),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: viewStateKeys.byProject(variables.areaId, variables.projectId),
      });
    },
  });
}

// Re-export helpers from lib
export { sortTasksByOrder, calculateNewOrder } from "@/lib/orbit/view-state";
