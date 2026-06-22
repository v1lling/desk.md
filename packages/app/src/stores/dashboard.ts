import { useQuery } from "@tanstack/react-query";
import * as dashboardLib from "@desk/core";

// Query keys
export const dashboardKeys = {
  all: ["dashboard"] as const,
  focusTasks: () => [...dashboardKeys.all, "focusTasks"] as const,
  workspaceSummaries: () => [...dashboardKeys.all, "workspaceSummaries"] as const,
};

/**
 * Hook to fetch all tasks highlighted "for focus" across workspaces
 */
export function useFocusTasks() {
  return useQuery({
    queryKey: dashboardKeys.focusTasks(),
    queryFn: () => dashboardLib.getFocusTasks(),
  });
}

/**
 * Hook to fetch workspace summaries for dashboard
 */
export function useWorkspaceSummaries() {
  return useQuery({
    queryKey: dashboardKeys.workspaceSummaries(),
    queryFn: () => dashboardLib.getWorkspaceSummaries(),
  });
}

// Note: Personal summary is now part of workspace summaries
