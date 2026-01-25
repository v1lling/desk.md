"use client";

import { useCallback } from "react";
import { useProjects } from "@/stores";
import { isUnassigned } from "@/lib/orbit/constants";

/**
 * Hook for project name lookup. Provides a callback to get project name by ID.
 * Returns null for unassigned projects, the project name if found, or the ID as fallback.
 */
export function useProjectName(workspaceId: string | null) {
  const { data: projects = [] } = useProjects(workspaceId);

  const getProjectName = useCallback(
    (projectId: string): string | null => {
      if (isUnassigned(projectId)) return null;
      const project = projects.find((p) => p.id === projectId);
      return project?.name || projectId;
    },
    [projects]
  );

  return { projects, getProjectName };
}
