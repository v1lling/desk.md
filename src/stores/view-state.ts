import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskStatus, ProjectViewState } from "@/types";
import * as viewStateLib from "@/lib/orbit/view-state";

// Query keys
export const viewStateKeys = {
  all: ["viewState"] as const,
  // projectId can be null for workspace-level (All Tasks) view state
  byScope: (workspaceId: string, projectId: string | null) =>
    [...viewStateKeys.all, workspaceId, projectId ?? "_workspace"] as const,
};

/**
 * Hook to fetch view state for a project or workspace
 * @param workspaceId - The workspace ID
 * @param projectId - The project ID, or null for workspace-level (All Tasks)
 */
export function useViewState(workspaceId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: viewStateKeys.byScope(workspaceId || "", projectId),
    queryFn: () => viewStateLib.getViewState(workspaceId!, projectId),
    enabled: !!workspaceId, // Only need workspaceId, projectId can be null
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
      workspaceId,
      projectId,
      taskOrder,
    }: {
      workspaceId: string;
      projectId: string | null;
      taskOrder: Record<TaskStatus, string[]>;
    }) => viewStateLib.updateTaskOrder(workspaceId, projectId, taskOrder),
    onMutate: async ({ workspaceId, projectId, taskOrder }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: viewStateKeys.byScope(workspaceId, projectId),
      });

      // Snapshot previous state
      const previousState = queryClient.getQueryData<ProjectViewState>(
        viewStateKeys.byScope(workspaceId, projectId)
      );

      // Optimistically update
      queryClient.setQueryData<ProjectViewState>(
        viewStateKeys.byScope(workspaceId, projectId),
        (old) => ({
          ...old,
          taskOrder,
        })
      );

      return { previousState, workspaceId, projectId };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context) {
        queryClient.setQueryData(
          viewStateKeys.byScope(context.workspaceId, context.projectId),
          context.previousState
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      // Refetch after mutation settles
      queryClient.invalidateQueries({
        queryKey: viewStateKeys.byScope(variables.workspaceId, variables.projectId),
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
      workspaceId,
      projectId,
      taskId,
    }: {
      workspaceId: string;
      projectId: string | null;
      taskId: string;
    }) => viewStateLib.removeTaskFromOrder(workspaceId, projectId, taskId),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: viewStateKeys.byScope(variables.workspaceId, variables.projectId),
      });
    },
  });
}

// Re-export helpers from lib
export { sortTasksByOrder } from "@/lib/orbit/view-state";
