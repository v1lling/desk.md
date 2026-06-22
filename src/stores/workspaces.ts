import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Workspace } from "@/types";
import { getDeskService } from "@/lib/desk/service";
import { writeTopLevelAgentFiles, writePerWorkspaceAgentFiles } from "@/lib/context-index/agent-context";
import { useAgentInstructionsStore } from "./agent-instructions";
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
 * Hook to fetch a single workspace
 */
export function useWorkspace(workspaceId: string | null) {
  return useQuery({
    queryKey: workspaceKeys.detail(workspaceId || ""),
    queryFn: () => getDeskService().getWorkspace(workspaceId!),
    enabled: !!workspaceId,
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
      updates: Partial<Pick<Workspace, "name" | "description" | "color">>;
    }) => getDeskService().updateWorkspace(workspaceId, updates),
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
    onSuccess: (_data, workspaceId) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      // Drop any per-workspace agent instructions for the deleted workspace.
      useAgentInstructionsStore.getState().clearForWorkspace(workspaceId);
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
