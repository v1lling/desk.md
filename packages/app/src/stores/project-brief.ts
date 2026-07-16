import { useMemo } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  getDeskService,
  extractDocs,
  findProjectBrief,
  findProjectState,
  computeContextFreshness,
  selectChangedRecords,
  type BriefSeed,
} from "@desk/core";
import { useContentTree, contentKeys } from "./content";
import { useProjectTasks } from "./tasks";
import { useProjectMeetings } from "./meetings";
import { useAIMaintenanceSettingsStore } from "./ai-maintenance-settings";
import { useProviderConfigured } from "@/hooks/use-ai-maintenance-info";
import { ensureAIConsent } from "./ai-consent";
import { isLocalDisk } from "@/lib/connection";

/**
 * Everything the Context panel needs for one project, from the four queries Project Home
 * already mounts plus one new context-tree read.
 *
 * `records` is the panel's ONE definition of "what changed since the state file was last
 * written" — both the freshness count and the background refresh payload derive from the same
 * core functions, so the number the user sees and the records the model reconciles against
 * cannot drift apart.
 */
export function useProjectContext(workspaceId: string, projectId: string) {
  const { data: contextTree = [], isLoading } = useContentTree(
    "project",
    workspaceId,
    projectId,
    "context",
  );
  const { data: tasks = [] } = useProjectTasks(workspaceId, projectId);
  const { data: meetings = [] } = useProjectMeetings(workspaceId, projectId);
  const { data: docTree = [] } = useContentTree("project", workspaceId, projectId, "doc");

  const contextDocs = useMemo(() => extractDocs(contextTree), [contextTree]);
  const docs = useMemo(() => extractDocs(docTree), [docTree]);

  // Tasks + meetings + docs of kind "doc" ONLY. Letting a context doc in here would have the
  // map compared against itself.
  const allRecords = useMemo(
    () => [...tasks, ...meetings, ...docs],
    [tasks, meetings, docs],
  );

  const brief = useMemo(() => findProjectBrief(contextDocs), [contextDocs]);
  const state = useMemo(() => findProjectState(contextDocs), [contextDocs]);
  const others = useMemo(
    () => contextDocs.filter((doc) => doc.id !== brief?.id && doc.id !== state?.id),
    [contextDocs, brief, state],
  );

  // Freshness is scoped to the STATE file, not all of context/ — editing the brief or a
  // hand-written context file says nothing about whether the AI snapshot has seen the records.
  const freshness = useMemo(
    () => computeContextFreshness(state, allRecords),
    [state, allRecords],
  );
  const records = useMemo(
    () => selectChangedRecords(state, allRecords),
    [state, allRecords],
  );

  return { brief, state, others, contextDocs, records, freshness, isLoading };
}

/** Create the project's brief, or return the one already there. Never overwrites. */
export function useEnsureProjectBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: {
      workspaceId: string;
      projectId: string;
      projectName: string;
      seed?: BriefSeed;
    }) => getDeskService().ensureProjectBrief(vars),
    onSuccess: (_doc, vars) => {
      invalidateContext(queryClient, vars.workspaceId, vars.projectId);
    },
  });
}

/**
 * `useUpdateDoc` does not invalidate tree queries — it only `setQueriesData`s over `Doc[]`
 * caches, and a tree query's cached value is `FileTreeNode[]`, so the updater is a no-op there.
 * Every context write must therefore invalidate these keys by hand or the panel keeps showing
 * the pre-write body and the old freshness verdict. Exported: the background state refresh
 * (state-refresh.ts, via the watcher wiring) needs the same invalidation after its write.
 */
export function invalidateContext(
  queryClient: QueryClient,
  workspaceId: string,
  projectId: string,
) {
  queryClient.invalidateQueries({
    queryKey: contentKeys.tree("project", workspaceId, projectId, "context"),
  });
  queryClient.invalidateQueries({
    queryKey: contentKeys.mergedTree("project", workspaceId, projectId),
  });
  queryClient.invalidateQueries({ queryKey: contentKeys.mergedOverview(workspaceId) });
}

/**
 * True when an AI refresh can actually run, on whichever host owns the data — a key for the
 * selected provider resolves there (this machine's Keychain locally, the server's env in hosted
 * mode). One source of truth: `getAIMaintenanceInfo`, via the shared hook.
 */
export function useCanRunAI(): boolean {
  const providerType = useAIMaintenanceSettingsStore((s) => s.providerType);
  return useProviderConfigured(providerType);
}

/**
 * Manual "refresh now" for the state file, executed by whichever host owns the data (the
 * service call runs the engine in-process locally, on the server in hosted mode). The
 * background engine is the normal path; this exists for impatience. Consent prompts only in
 * local mode — on a server, the operator consented by configuring a key in the environment.
 */
export function useRefreshState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { workspaceId: string; projectId: string }) => {
      if (isLocalDisk() && !(await ensureAIConsent())) {
        throw new Error("AI consent declined");
      }
      return getDeskService().refreshProjectState(vars.workspaceId, vars.projectId);
    },
    onSuccess: (_result, vars) => {
      invalidateContext(queryClient, vars.workspaceId, vars.projectId);
    },
  });
}
