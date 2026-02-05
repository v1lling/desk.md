import { useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TaskStatus, ProjectViewState, TaskViewMode } from "@/types";
import * as viewStateLib from "@/lib/desk/view-state";
import { PERSONAL_WORKSPACE_ID, WORKSPACE_LEVEL_PROJECT_ID } from "@/lib/desk/constants";

// Query keys
export const viewStateKeys = {
  all: ["viewState"] as const,
  // projectId can be null for workspace-level (All Tasks) view state
  byScope: (workspaceId: string, projectId: string | null) =>
    [...viewStateKeys.all, workspaceId, projectId ?? WORKSPACE_LEVEL_PROJECT_ID] as const,
};

/**
 * Hook to fetch view state for a project or workspace
 * @param workspaceId - The workspace ID
 * @param projectId - The project ID, or null for workspace-level (All Tasks)
 */
export function useViewState(workspaceId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: viewStateKeys.byScope(workspaceId || "", projectId),
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return viewStateLib.getViewState(workspaceId, projectId);
    },
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
    // No onSettled/invalidate - optimistic update is sufficient
    // Invalidating causes flicker due to race with file write
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
 * @param workspaceId - The workspace ID (including Personal workspace)
 * @param projectId - The project ID, or null for workspace-level
 * @param defaultMode - Default mode if not set (Personal=list, projects=kanban)
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
    mutationFn: async (newMode: TaskViewMode) => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return viewStateLib.setViewMode(workspaceId, projectId, newMode);
    },
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
 * Hook for Personal workspace view mode (convenience wrapper)
 * Default is 'list' for Personal tasks
 */
export function usePersonalViewMode() {
  return useViewMode(PERSONAL_WORKSPACE_ID, null, "list");
}

/**
 * Hook to get/set expanded folders for content tree view
 * Returns the current expanded folders and a function to update them
 *
 * @param workspaceId - The workspace ID (including Personal workspace)
 * @param projectId - The project ID, or null for workspace-level
 */
export function useExpandedFolders(
  workspaceId: string | null,
  projectId: string | null
) {
  const queryClient = useQueryClient();
  const { data: viewState } = useViewState(workspaceId, projectId);

  // Memoize to avoid creating new array reference when viewState is undefined
  const expandedFolders = useMemo(
    () => viewState?.expandedFolders ?? [],
    [viewState?.expandedFolders]
  );

  const mutation = useMutation({
    mutationFn: async (folders: string[]) => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return viewStateLib.setExpandedFolders(workspaceId, projectId, folders);
    },
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
          expandedFolders: folders,
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

  // Memoize the setExpandedFolders callback to prevent recreating on every render
  const setExpandedFolders = useCallback(
    (folders: string[]) => mutation.mutate(folders),
    [mutation.mutate]
  );

  return {
    expandedFolders,
    setExpandedFolders,
    isLoading: mutation.isPending,
  };
}

/**
 * Hook to get highlighted tasks and toggle highlight
 * Returns set of highlighted task IDs and a toggle function
 *
 * @param workspaceId - The workspace ID
 * @param projectId - The project ID, or null for workspace-level
 */
export function useHighlightedTasks(
  workspaceId: string | null,
  projectId: string | null
) {
  const queryClient = useQueryClient();
  const { data: viewState } = useViewState(workspaceId, projectId);

  const highlightedTasks = useMemo(
    () => new Set(viewState?.highlightedTasks ?? []),
    [viewState?.highlightedTasks]
  );

  const toggleMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return viewStateLib.toggleTaskHighlight(workspaceId, projectId, taskId);
    },
    onMutate: async (taskId) => {
      if (!workspaceId) return;

      await queryClient.cancelQueries({
        queryKey: viewStateKeys.byScope(workspaceId, projectId),
      });

      const previousState = queryClient.getQueryData<ProjectViewState>(
        viewStateKeys.byScope(workspaceId, projectId)
      );

      const currentHighlighted = previousState?.highlightedTasks ?? [];
      const isHighlighted = currentHighlighted.includes(taskId);
      const newHighlighted = isHighlighted
        ? currentHighlighted.filter(id => id !== taskId)
        : [...currentHighlighted, taskId];

      queryClient.setQueryData<ProjectViewState>(
        viewStateKeys.byScope(workspaceId, projectId),
        (old) => ({
          ...old,
          highlightedTasks: newHighlighted,
        })
      );

      return { previousState };
    },
    onError: (_err, _taskId, context) => {
      if (context?.previousState && workspaceId) {
        queryClient.setQueryData(
          viewStateKeys.byScope(workspaceId, projectId),
          context.previousState
        );
      }
    },
  });

  const toggleHighlight = useCallback(
    (taskId: string) => toggleMutation.mutate(taskId),
    [toggleMutation.mutate]
  );

  return {
    highlightedTasks,
    toggleHighlight,
    isLoading: toggleMutation.isPending,
  };
}

// Re-export helpers from lib
export { sortTasksByOrder } from "@/lib/desk/view-state";
