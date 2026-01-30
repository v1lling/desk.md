import { useQuery } from "@tanstack/react-query";
import * as dashboardLib from "@/lib/desk/dashboard";

// Query keys
export const dashboardKeys = {
  all: ["dashboard"] as const,
  activeTasks: () => [...dashboardKeys.all, "activeTasks"] as const,
  workspaceSummaries: () => [...dashboardKeys.all, "workspaceSummaries"] as const,
  personalSummary: () => [...dashboardKeys.all, "personalSummary"] as const,
};

/**
 * Hook to fetch all active (doing) tasks across workspaces
 */
export function useActiveTasks() {
  return useQuery({
    queryKey: dashboardKeys.activeTasks(),
    queryFn: () => dashboardLib.getActiveTasks(),
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

/**
 * Hook to fetch personal space summary
 */
export function usePersonalSummary() {
  return useQuery({
    queryKey: dashboardKeys.personalSummary(),
    queryFn: () => dashboardLib.getPersonalSummary(),
  });
}
