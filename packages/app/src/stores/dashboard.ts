import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  getDeskService,
  type DashboardOverview,
  type DashboardTaskItem,
} from "@desk/core";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  overviewRoot: () => [...dashboardKeys.all, "overview"] as const,
  overview: (today: string) => [...dashboardKeys.overviewRoot(), today] as const,
};

/** One shared invalidation path for mutations and filesystem watcher events. */
export function invalidateDashboardOverview(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.overviewRoot() });
}

export function useDashboardOverview(today: string) {
  return useQuery({
    queryKey: dashboardKeys.overview(today),
    queryFn: () => getDeskService().getDashboardOverview({ today, recentLimit: 5 }),
  });
}

function isSameDashboardTask(
  left: DashboardTaskItem,
  right: Pick<DashboardTaskItem, "id" | "workspaceId" | "projectId">,
): boolean {
  return left.id === right.id
    && left.workspaceId === right.workspaceId
    && left.projectId === right.projectId;
}

/** Remove a dashboard task from every Focus scope with optimistic UI. */
export function useClearFocusTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: DashboardTaskItem) =>
      getDeskService().clearTaskHighlight(task.workspaceId, task.projectId, task.id),
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: dashboardKeys.overviewRoot() });
      const previous = queryClient.getQueriesData<DashboardOverview>({
        queryKey: dashboardKeys.overviewRoot(),
      });

      queryClient.setQueriesData<DashboardOverview>(
        { queryKey: dashboardKeys.overviewRoot() },
        (overview) => overview
          ? {
              ...overview,
              focusTasks: overview.focusTasks.filter(
                (candidate) => !isSameDashboardTask(candidate, task),
              ),
            }
          : overview,
      );

      return { previous };
    },
    onError: (_error, _task, context) => {
      for (const [queryKey, data] of context?.previous ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: () => {
      invalidateDashboardOverview(queryClient);
      // clearTaskHighlight writes both workspace and project view-state scopes.
      void queryClient.invalidateQueries({ queryKey: ["viewState"] });
    },
  });
}
