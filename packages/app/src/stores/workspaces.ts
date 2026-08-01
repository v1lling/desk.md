import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { WorkspaceUpdate } from "@desk/core/types";
import { getDeskService } from "@desk/core";
import { writeTopLevelAgentFiles, writePerWorkspaceAgentFiles } from "@/lib/smart-index/agent-files";
import { useNavigationStore } from "./navigation";

// Query keys
export const workspaceKeys = {
  all: ["workspaces"] as const,
  detail: (workspaceId: string) => [...workspaceKeys.all, "detail", workspaceId] as const,
};

/**
 * Hook to fetch all workspaces
 */
export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.all,
    queryFn: () => getDeskService().getWorkspaces(),
  });
}

/**
 * Hook to create a new workspace
 */
export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      id: string;
      name: string;
      description?: string;
      overview?: string;
      color?: string;
      home?: boolean;
    }) => getDeskService().createWorkspace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      // Regenerate top-level agent files (workspace list changed)
      getDeskService().getWorkspaces().then((ws) => writeTopLevelAgentFiles(ws)).catch(() => {});
    },
  });
}

/**
 * Hook to update a workspace
 */
export function useUpdateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      updates,
    }: {
      workspaceId: string;
      updates: WorkspaceUpdate;
    }) =>
      getDeskService().updateWorkspace(workspaceId, updates).then((workspace) => {
        if (!workspace) throw new Error(`Workspace '${workspaceId}' no longer exists`);
        return workspace;
      }),
    onSuccess: (updatedWorkspace, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      // Regenerate agent files (name/description may have changed)
      getDeskService().getWorkspaces().then((ws) => writeTopLevelAgentFiles(ws)).catch(() => {});
      if (updatedWorkspace) {
        getDeskService().getProjects(workspaceId).then((projects) =>
          writePerWorkspaceAgentFiles(workspaceId, updatedWorkspace, projects)
        ).catch(() => {});
      }
    },
  });
}

/**
 * Hook to delete a workspace
 */
export function useDeleteWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) => getDeskService().deleteWorkspace(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      // Regenerate top-level agent files (workspace removed)
      getDeskService().getWorkspaces().then((ws) => writeTopLevelAgentFiles(ws)).catch(() => {});
    },
  });
}

/**
 * Selector hook to get the current workspace
 */
export function useCurrentWorkspace() {
  const { data: workspaces = [] } = useWorkspaces();
  const currentWorkspaceId = useNavigationStore((state) => state.currentWorkspaceId);
  return workspaces.find((workspace) => workspace.id === currentWorkspaceId) || workspaces[0] || null;
}

/**
 * Selector hook to get the home workspace (owns the capture inbox, sorted first)
 */
export function useHomeWorkspace() {
  const { data: workspaces = [] } = useWorkspaces();
  return workspaces.find((workspace) => workspace.isHome) || workspaces[0] || null;
}
