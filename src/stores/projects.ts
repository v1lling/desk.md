import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project, ProjectStatus } from "@/types";
import * as projectLib from "@/lib/orbit/projects";

// Query keys
export const projectKeys = {
  all: ["projects"] as const,
  byArea: (areaId: string) => [...projectKeys.all, "area", areaId] as const,
  detail: (areaId: string, projectId: string) =>
    [...projectKeys.byArea(areaId), "detail", projectId] as const,
  stats: (areaId: string) => [...projectKeys.byArea(areaId), "stats"] as const,
};

/**
 * Hook to fetch all projects for an area
 */
export function useProjects(areaId: string | null) {
  return useQuery({
    queryKey: projectKeys.byArea(areaId || ""),
    queryFn: () => projectLib.getProjects(areaId!),
    enabled: !!areaId,
  });
}

/**
 * Hook to fetch a single project
 */
export function useProject(areaId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: projectKeys.detail(areaId || "", projectId || ""),
    queryFn: () => projectLib.getProject(areaId!, projectId!),
    enabled: !!areaId && !!projectId,
  });
}

/**
 * Hook to fetch project stats for an area
 */
export function useProjectStats(areaId: string | null) {
  return useQuery({
    queryKey: projectKeys.stats(areaId || ""),
    queryFn: () => projectLib.getProjectStats(areaId!),
    enabled: !!areaId,
  });
}

/**
 * Hook to create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      areaId: string;
      name: string;
      description?: string;
      status?: ProjectStatus;
    }) => projectLib.createProject(data),
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.byArea(newProject.areaId),
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
      areaId,
      updates,
    }: {
      projectId: string;
      areaId: string;
      updates: Partial<Pick<Project, "name" | "status" | "description">>;
    }) => projectLib.updateProject(projectId, updates, areaId),
    onSuccess: (updatedProject, variables) => {
      if (updatedProject) {
        queryClient.invalidateQueries({
          queryKey: projectKeys.byArea(variables.areaId),
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
    mutationFn: ({ projectId, areaId }: { projectId: string; areaId: string }) =>
      projectLib.deleteProject(projectId, areaId).then((success) => ({ success, areaId })),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: projectKeys.byArea(result.areaId),
        });
      }
    },
  });
}
