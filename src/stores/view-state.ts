import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskStatus, ProjectViewState, TaskViewMode } from "@/types";
import * as viewStateLib from "@/lib/orbit/view-state";
import { PERSONAL_SPACE_ID } from "@/lib/orbit/constants";

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
    staleTime: 30000, // Trust cached value for 30s to prevent flicker on view switch
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

/**
 * Hook to get/set view mode (list or kanban)
 * Returns the current view mode and a function to change it
 *
 * @param workspaceId - The workspace ID (or PERSONAL_SPACE_ID for personal space)
 * @param projectId - The project ID, or null for workspace-level
 * @param defaultMode - Default mode if not set (personal=list, projects=kanban)
 */
export function useViewMode(
  workspaceId: string | null,
  projectId: string | null,
  defaultMode: TaskViewMode = "kanban"
) {
  const queryClient = useQueryClient();
  const { data: viewState } = useViewState(workspaceId, projectId);

  const viewMode = viewState?.viewMode ?? defaultMode;

  const setViewMode = useMutation({
    mutationFn: (newMode: TaskViewMode) =>
      viewStateLib.setViewMode(workspaceId!, projectId, newMode),
    onMutate: async (newMode) => {
      if (!workspaceId) return;

      await queryClient.cancelQueries({
        queryKey: viewStateKeys.byScope(workspaceId, projectId),
      });

      const previousState = queryClient.getQueryData<ProjectViewState>(
        viewStateKeys.byScope(workspaceId, projectId)
      );

      queryClient.setQueryData<ProjectViewState>(
        viewStateKeys.byScope(workspaceId, projectId),
        (old) => ({
          ...old,
          viewMode: newMode,
        })
      );

      return { previousState };
    },
    onError: (_err, _newMode, context) => {
      // Rollback on error
      if (context?.previousState && workspaceId) {
        queryClient.setQueryData(
          viewStateKeys.byScope(workspaceId, projectId),
          context.previousState
        );
      }
    },
    // No onSettled/invalidate - optimistic update is sufficient
    // Invalidating causes flicker due to race with file write
  });

  return {
    viewMode,
    setViewMode: (mode: TaskViewMode) => setViewMode.mutate(mode),
    isLoading: setViewMode.isPending,
  };
}

/**
 * Hook for personal space view mode (convenience wrapper)
 * Default is 'list' for personal tasks
 */
export function usePersonalViewMode() {
  return useViewMode(PERSONAL_SPACE_ID, null, "list");
}

/**
 * Hook to get/set expanded doc folders for tree view
 * Returns the current expanded folders and a function to update them
 *
 * @param workspaceId - The workspace ID (or PERSONAL_SPACE_ID for personal space)
 * @param projectId - The project ID, or null for workspace-level
 */
export function useExpandedDocFolders(
  workspaceId: string | null,
  projectId: string | null
) {
  const queryClient = useQueryClient();
  const { data: viewState } = useViewState(workspaceId, projectId);

  const expandedFolders = viewState?.expandedDocFolders ?? [];

  const setExpandedFolders = useMutation({
    mutationFn: (folders: string[]) =>
      viewStateLib.setExpandedDocFolders(workspaceId!, projectId, folders),
    onMutate: async (folders) => {
      if (!workspaceId) return;

      await queryClient.cancelQueries({
        queryKey: viewStateKeys.byScope(workspaceId, projectId),
      });

      const previousState = queryClient.getQueryData<ProjectViewState>(
        viewStateKeys.byScope(workspaceId, projectId)
      );

      queryClient.setQueryData<ProjectViewState>(
        viewStateKeys.byScope(workspaceId, projectId),
        (old) => ({
          ...old,
          expandedDocFolders: folders,
        })
      );

      return { previousState };
    },
    onError: (_err, _folders, context) => {
      if (context?.previousState && workspaceId) {
        queryClient.setQueryData(
          viewStateKeys.byScope(workspaceId, projectId),
          context.previousState
        );
      }
    },
  });

  return {
    expandedFolders,
    setExpandedFolders: (folders: string[]) => setExpandedFolders.mutate(folders),
    toggleFolder: (folderPath: string) => {
      const newFolders = expandedFolders.includes(folderPath)
        ? expandedFolders.filter((f) => f !== folderPath)
        : [...expandedFolders, folderPath];
      setExpandedFolders.mutate(newFolders);
    },
    isLoading: setExpandedFolders.isPending,
  };
}

// Re-export helpers from lib
export { sortTasksByOrder } from "@/lib/orbit/view-state";
