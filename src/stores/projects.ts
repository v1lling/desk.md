import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project, ProjectStatus } from "@/types";
import * as projectLib from "@/lib/desk/projects";

// Query keys
export const projectKeys = {
  all: ["projects"] as const,
  byWorkspace: (workspaceId: string) => [...projectKeys.all, "workspace", workspaceId] as const,
  detail: (workspaceId: string, projectId: string) =>
    [...projectKeys.byWorkspace(workspaceId), "detail", projectId] as const,
  stats: (workspaceId: string) => [...projectKeys.byWorkspace(workspaceId), "stats"] as const,
};

/**
 * Hook to fetch all projects for a workspace
 */
export function useProjects(workspaceId: string | null) {
  return useQuery({
    queryKey: projectKeys.byWorkspace(workspaceId || ""),
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return projectLib.getProjects(workspaceId);
    },
    enabled: !!workspaceId,
  });
}

/**
 * Hook to fetch a single project
 */
export function useProject(workspaceId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: projectKeys.detail(workspaceId || "", projectId || ""),
    queryFn: async () => {
      if (!workspaceId || !projectId) throw new Error("workspaceId and projectId are required");
      return projectLib.getProject(workspaceId, projectId);
    },
    enabled: !!workspaceId && !!projectId,
  });
}

/**
 * Hook to fetch project stats for a workspace
 */
export function useProjectStats(workspaceId: string | null) {
  return useQuery({
    queryKey: projectKeys.stats(workspaceId || ""),
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return projectLib.getProjectStats(workspaceId);
    },
    enabled: !!workspaceId,
  });
}

/**
 * Hook to create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      workspaceId: string;
      name: string;
      description?: string;
      status?: ProjectStatus;
    }) => projectLib.createProject(data),
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.byWorkspace(newProject.workspaceId),
      });
    },
  });
}

/**
 * Hook to update a project
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      workspaceId,
      updates,
    }: {
      projectId: string;
      workspaceId: string;
      updates: Partial<Pick<Project, "name" | "status" | "description">>;
    }) => projectLib.updateProject(projectId, updates, workspaceId),
    onSuccess: (updatedProject, variables) => {
      if (updatedProject) {
        queryClient.invalidateQueries({
          queryKey: projectKeys.byWorkspace(variables.workspaceId),
        });
      }
    },
  });
}

/**
 * Hook to delete a project
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, workspaceId }: { projectId: string; workspaceId: string }) =>
      projectLib.deleteProject(projectId, workspaceId).then((success) => ({ success, workspaceId })),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: projectKeys.byWorkspace(result.workspaceId),
        });
      }
    },
  });
}
