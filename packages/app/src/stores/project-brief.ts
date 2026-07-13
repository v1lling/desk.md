import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDeskService,
  isTauri,
  extractDocs,
  findProjectBrief,
  computeContextFreshness,
  selectChangedRecords,
  mergeAISections,
  BRIEF_SECTIONS,
  type BriefSeed,
  type SectionMergeResult,
} from "@desk/core";
import type { Doc } from "@desk/core/types";
import { useContentTree, contentKeys } from "./content";
import { useProjectTasks } from "./tasks";
import { useProjectMeetings } from "./meetings";
import { useAISettingsStore, useAIUsageStore } from "./ai";
import { ensureAIConsent } from "./ai-consent";
import { createAIService } from "@/lib/ai/service";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";

/** The brief needs signal, not the full corpus, so only the head of `records` is sent. */
const MAX_RECORDS = 25;
const MAX_RECORD_CHARS = 400;

/**
 * Everything the Context panel needs for one project, from the four queries Project Home
 * already mounts plus one new context-tree read.
 *
 * `records` is the panel's ONE definition of "what changed since the map was last touched" —
 * both the freshness count and the AI refresh payload derive from it, so the number the user
 * sees and the records the model reconciles against cannot drift apart.
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

  const freshness = useMemo(
    () => computeContextFreshness(contextDocs, allRecords),
    [contextDocs, allRecords],
  );
  const records = useMemo(
    () => selectChangedRecords(contextDocs, allRecords),
    [contextDocs, allRecords],
  );

  const brief = useMemo(() => findProjectBrief(contextDocs), [contextDocs]);
  const others = useMemo(
    () => contextDocs.filter((doc) => doc.id !== brief?.id),
    [contextDocs, brief],
  );

  return { brief, others, contextDocs, records, freshness, isLoading };
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
 * the pre-write body and the old freshness verdict.
 */
function invalidateContext(
  queryClient: ReturnType<typeof useQueryClient>,
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

interface RecordLike {
  title: string;
  content?: string;
  updated?: string;
  created?: string;
}

/**
 * `records` must already be the changed-since set, newest first (`selectChangedRecords`). This
 * only truncates it, so the cut keeps the most recent work rather than an arbitrary prefix — and
 * the header below is then true of what it labels.
 */
function buildRefreshPayload(brief: Doc, records: RecordLike[]): string {
  const recent = records
    .slice(0, MAX_RECORDS)
    .map((r) => {
      const body = (r.content ?? "").trim().slice(0, MAX_RECORD_CHARS);
      const stamp = r.updated ?? r.created ?? "";
      return `### ${r.title}${stamp ? ` (${stamp})` : ""}\n${body}`;
    })
    .join("\n\n");

  return [
    "# Current brief",
    "",
    brief.content ?? "",
    "",
    "# Records changed since the brief was last touched",
    "",
    recent || "(none)",
  ].join("\n");
}

/** True when an AI refresh can actually run: a key lives in the OS Keychain, so Tauri only. */
export function useCanRunAI(): boolean {
  const providerType = useAISettingsStore((s) => s.providerType);
  const providerConfigured = useAISettingsStore((s) => s.providerConfigured);
  return isTauri() && providerConfigured[providerType];
}

/**
 * Ask the model to reconcile the brief against the records that changed since, then merge its
 * answer through `mergeAISections` — which rebuilds the document from the ORIGINAL's headings,
 * so the user's own sections cannot be rewritten and a decision cannot be dropped, whatever the
 * model returns.
 *
 * This mutation does NOT write. It returns a merge result for the preview dialog to show; the
 * dialog applies it.
 */
export function useRefreshBrief() {
  return useMutation<SectionMergeResult, Error, { brief: Doc; records: RecordLike[] }>({
    mutationFn: async ({ brief, records }) => {
      if (!(await ensureAIConsent())) {
        throw new Error("AI consent declined");
      }
      const { providerType, modelByProvider } = useAISettingsStore.getState();
      const service = createAIService({
        providerType,
        model: modelByProvider[providerType] || undefined,
        onUsage: (usage) =>
          useAIUsageStore.getState().addRecord({
            purpose: "context-refresh",
            provider: providerType,
            usage,
          }),
      });

      const { message } = await service.custom(
        SYSTEM_PROMPTS.refreshBrief,
        buildRefreshPayload(brief, records),
      );

      return mergeAISections(brief.content ?? "", message, BRIEF_SECTIONS);
    },
  });
}

/** Write an accepted merge back to the brief. */
export function useApplyBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ brief, content }: { brief: Doc; content: string }) =>
      getDeskService().updateDoc(brief, { content }),
    onSuccess: (_doc, vars) => {
      invalidateContext(queryClient, vars.brief.workspaceId, vars.brief.projectId);
    },
  });
}

/** The prompt + payload as plain text, for the no-key path (paste into an MCP agent). */
export function buildRefreshPromptText(brief: Doc, records: RecordLike[]): string {
  return `${SYSTEM_PROMPTS.refreshBrief}\n\n---\n\n${buildRefreshPayload(brief, records)}`;
}
