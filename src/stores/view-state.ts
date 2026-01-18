import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskStatus, ProjectViewState } from "@/types";
import * as viewStateLib from "@/lib/orbit/view-state";

// Query keys
export const viewStateKeys = {
  all: ["viewState"] as const,
  // projectId can be null for area-level (All Tasks) view state
  byScope: (areaId: string, projectId: string | null) =>
    [...viewStateKeys.all, areaId, projectId ?? "_area"] as const,
};

/**
 * Hook to fetch view state for a project or area
 * @param areaId - The area ID
 * @param projectId - The project ID, or null for area-level (All Tasks)
 */
export function useViewState(areaId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: viewStateKeys.byScope(areaId || "", projectId),
    queryFn: () => viewStateLib.getViewState(areaId!, projectId),
    enabled: !!areaId, // Only need areaId, projectId can be null
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
      projectId: string | null;
      taskOrder: Record<TaskStatus, string[]>;
    }) => viewStateLib.updateTaskOrder(areaId, projectId, taskOrder),
    onMutate: async ({ areaId, projectId, taskOrder }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: viewStateKeys.byScope(areaId, projectId),
      });

      // Snapshot previous state
      const previousState = queryClient.getQueryData<ProjectViewState>(
        viewStateKeys.byScope(areaId, projectId)
      );

      // Optimistically update
      queryClient.setQueryData<ProjectViewState>(
        viewStateKeys.byScope(areaId, projectId),
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
          viewStateKeys.byScope(context.areaId, context.projectId),
          context.previousState
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      // Refetch after mutation settles
      queryClient.invalidateQueries({
        queryKey: viewStateKeys.byScope(variables.areaId, variables.projectId),
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
      projectId: string | null;
      taskId: string;
    }) => viewStateLib.removeTaskFromOrder(areaId, projectId, taskId),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: viewStateKeys.byScope(variables.areaId, variables.projectId),
      });
    },
  });
}

// Re-export helpers from lib
export { sortTasksByOrder } from "@/lib/orbit/view-state";
