import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project, ProjectStatus } from "@/types";
import { getDeskService } from "@/lib/desk/service";
import { writePerWorkspaceAgentFiles } from "@/lib/context-index/agent-context";
import { contentKeys } from "./content";

/** Regenerate per-workspace agent files when projects change */
function regenerateWorkspaceAgentFiles(workspaceId: string) {
  Promise.all([getDeskService().getWorkspace(workspaceId), getDeskService().getProjects(workspaceId)])
    .then(([ws, projects]) => {
      if (ws) writePerWorkspaceAgentFiles(workspaceId, ws, projects);
    })
    .catch(() => {});
}

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
      return getDeskService().getProjects(workspaceId);
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
      return getDeskService().getProject(workspaceId, projectId);
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
      return getDeskService().getProjectStats(workspaceId);
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
    }) => getDeskService().createProject(data),
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.byWorkspace(newProject.workspaceId),
      });
      queryClient.invalidateQueries({
        queryKey: contentKeys.overview(newProject.workspaceId),
      });
      regenerateWorkspaceAgentFiles(newProject.workspaceId);
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
    }) => getDeskService().updateProject(projectId, updates, workspaceId),
    onSuccess: (updatedProject, variables) => {
      if (updatedProject) {
        queryClient.invalidateQueries({
          queryKey: projectKeys.byWorkspace(variables.workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: contentKeys.overview(variables.workspaceId),
        });
        regenerateWorkspaceAgentFiles(variables.workspaceId);
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
      getDeskService().deleteProject(projectId, workspaceId).then((success) => ({ success, workspaceId })),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: projectKeys.byWorkspace(result.workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: contentKeys.overview(result.workspaceId),
        });
        regenerateWorkspaceAgentFiles(result.workspaceId);
      }
    },
  });
}
