import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Workspace } from "@/types";
import * as workspaceLib from "@/lib/orbit/workspaces";
import { useSettingsStore } from "./settings";

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
    queryFn: () => workspaceLib.getWorkspaces(),
  });
}

/**
 * Hook to fetch a single workspace
 */
export function useWorkspace(workspaceId: string | null) {
  return useQuery({
    queryKey: workspaceKeys.detail(workspaceId || ""),
    queryFn: () => workspaceLib.getWorkspace(workspaceId!),
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
    }) => workspaceLib.createWorkspace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
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
    }) => workspaceLib.updateWorkspace(workspaceId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

/**
 * Hook to delete a workspace
 */
export function useDeleteWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) => workspaceLib.deleteWorkspace(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

/**
 * Selector hook to get the current workspace
 */
export function useCurrentWorkspace() {
  const { data: workspaces = [] } = useWorkspaces();
  const currentWorkspaceId = useSettingsStore((state) => state.currentWorkspaceId);
  return workspaces.find((workspace) => workspace.id === currentWorkspaceId) || workspaces[0] || null;
}
