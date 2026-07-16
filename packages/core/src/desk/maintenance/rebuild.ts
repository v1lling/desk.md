/**
 * Full Smart Index rebuild — the always-complete metadata catalog enriched with AI summaries,
 * reusing summaries for unchanged files (by contentHash) and batching new/changed files.
 * No AI key → entries simply keep `summary` undefined (no fake text preview).
 *
 * Lives in core so it runs on whichever host owns the data: called in-process by the app in
 * local mode (with progress callbacks) and as the `rebuildSmartIndex` DeskService method in
 * hosted mode.
 */
import { buildWorkspaceCatalog } from "../catalog/builder";
import { extractBody } from "../catalog/content-utils";
import type { IndexEntry, WorkspaceIndex } from "../catalog/types";
import { getAllDocsForWorkspace } from "../content-tree";
import { getTasks } from "../tasks";
import { getMeetings } from "../meetings";
import { getWorkspace } from "../workspaces";
import { getAIKeyResolver } from "../ai/key-resolver";
import { getProviderDefinition } from "../ai/provider-registry";
import { classifyAIError } from "../ai/errors";
import { SYSTEM_PROMPTS } from "../ai/prompts";
import {
  getAIMaintenanceSettings,
  createMaintenanceService,
  type AIMaintenanceSettings,
} from "./config";
import {
  getSummaryPreviewLength,
  SUMMARY_BATCH_SIZE,
  type BuildIndexProgress,
  type BuildIndexResult,
} from "./types";
import { readWorkspaceIndex, writeRebuiltWorkspaceIndex } from "./index-store-io";

/**
 * Summarize a batch of entries using AI, writing `summary` in place. Entries that the
 * AI doesn't return (or on failure) are left with `summary` undefined.
 */
async function summarizeBatch(
  entries: IndexEntry[],
  contents: Map<string, string>,
  settings: AIMaintenanceSettings,
): Promise<void> {
  const service = createMaintenanceService(settings, "index");

  const previewLength = getSummaryPreviewLength(settings.summaryDetail);
  const docs = entries.map((entry, i) => {
    const body = contents.get(entry.filePath) ?? "";
    const preview = body.slice(0, previewLength);
    // Fenced so document text reads as data, not as more numbered items or instructions
    // (the system prompt states the same rule).
    return `${i + 1}. [${entry.path}] Title: ${entry.title} | Type: ${entry.type}\n~~~~\n${preview}\n~~~~`;
  });

  const response = await service.custom(SYSTEM_PROMPTS.batchSummarize, `Documents:\n${docs.join("\n\n")}`);

  // Parse the JSON array of summaries from the response.
  const text = response.message.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    const summaries: string[] = JSON.parse(jsonMatch[0]);
    for (let i = 0; i < Math.min(summaries.length, entries.length); i++) {
      const s = summaries[i]?.trim();
      if (s) entries[i].summary = s;
    }
  }
}

/**
 * Build a workspace index in memory. Does NOT persist — both callers (`rebuildSmartIndex`
 * here, and the app's local rebuild in smart-index-section) persist via
 * `writeRebuiltWorkspaceIndex`, which merges out any incremental engine writes that landed
 * while the rebuild's AI batches ran.
 */
export async function rebuildWorkspaceIndex(
  workspaceId: string,
  workspaceName: string,
  existingIndex?: WorkspaceIndex,
  onProgress?: (progress: BuildIndexProgress) => void,
): Promise<{ index: WorkspaceIndex; result: BuildIndexResult }> {
  const result: BuildIndexResult = {
    totalFiles: 0,
    summarized: 0,
    reused: 0,
    excluded: 0,
    errors: [],
  };

  onProgress?.({ phase: "collecting", total: 0, processed: 0, newOrChanged: 0, currentWorkspace: workspaceName });

  // Metadata catalog: always complete, AI-free, .aiignore already applied.
  const catalog = await buildWorkspaceCatalog(workspaceId);
  result.excluded = catalog.excluded;

  // Map existing summaries by path (only reuse where the body hash is unchanged).
  const existingByPath = new Map<string, IndexEntry>();
  if (existingIndex) {
    for (const entry of existingIndex.entries) existingByPath.set(entry.path, entry);
  }

  const allEntries: IndexEntry[] = [];
  const needsSummarization: IndexEntry[] = [];

  for (const meta of catalog.entries) {
    const entry: IndexEntry = { ...meta };
    const existing = existingByPath.get(meta.path);
    if (existing?.summary && existing.contentHash === meta.contentHash) {
      entry.summary = existing.summary;
      result.reused++;
    } else {
      needsSummarization.push(entry);
    }
    allEntries.push(entry);
  }

  // Only summarize when a key resolves; otherwise ship the complete metadata catalog as-is.
  const settings = await getAIMaintenanceSettings();
  const key = await getAIKeyResolver()(getProviderDefinition(settings.providerType).keyRef);

  if (key && needsSummarization.length > 0) {
    // Fetch raw content and strip frontmatter (extractBody) so the AI summarizes body
    // text, not YAML. Four bulk reads, keyed by absolute filePath to match catalog entries.
    const [docs, contextDocs, tasks, meetings] = await Promise.all([
      getAllDocsForWorkspace(workspaceId, "doc"),
      getAllDocsForWorkspace(workspaceId, "context"),
      getTasks(workspaceId),
      getMeetings(workspaceId),
    ]);
    const contentMap = new Map<string, string>();
    for (const item of [...docs, ...contextDocs, ...tasks, ...meetings]) {
      contentMap.set(item.filePath, extractBody(item.content ?? ""));
    }

    onProgress?.({
      phase: "summarizing",
      total: needsSummarization.length,
      processed: 0,
      newOrChanged: needsSummarization.length,
      currentWorkspace: workspaceName,
    });

    for (let i = 0; i < needsSummarization.length; i += SUMMARY_BATCH_SIZE) {
      const batch = needsSummarization.slice(i, i + SUMMARY_BATCH_SIZE);
      try {
        await summarizeBatch(batch, contentMap, settings);
        result.summarized += batch.filter((e) => e.summary).length;
      } catch (error) {
        const aiErr = classifyAIError(error, settings.providerType);
        console.warn("[maintenance] Batch summarization failed:", aiErr);
        // A provider-wide failure (out of quota, bad key, unreachable) repeats identically for
        // every remaining batch — record it once and stop, instead of collecting N copies and
        // burning quota/tokens on calls we know will fail.
        if (aiErr.code === "quota" || aiErr.code === "auth" || aiErr.code === "network") {
          result.errors.push(aiErr.message);
          break;
        }
        // Transient/other: dedup by message so the panel shows one line, not one per batch.
        if (!result.errors.includes(aiErr.message)) result.errors.push(aiErr.message);
      }

      onProgress?.({
        phase: "summarizing",
        total: needsSummarization.length,
        processed: Math.min(i + SUMMARY_BATCH_SIZE, needsSummarization.length),
        newOrChanged: needsSummarization.length,
        currentWorkspace: workspaceName,
      });
    }
  }

  result.totalFiles = allEntries.length;

  const now = new Date().toISOString();
  const index: WorkspaceIndex = {
    workspaceId,
    workspaceName: catalog.workspaceName || workspaceName,
    entries: allEntries,
    builtAt: now,
    updatedAt: now,
    fileCount: allEntries.length,
  };

  onProgress?.({
    phase: "done",
    total: allEntries.length,
    processed: allEntries.length,
    newOrChanged: needsSummarization.length,
    currentWorkspace: workspaceName,
  });

  return { index, result };
}

/**
 * Service-shaped rebuild: reads the existing index, rebuilds, persists. Used by the Settings
 * "Rebuild" action in hosted mode (spinner, no progress over RPC).
 */
export async function rebuildSmartIndex(workspaceId: string): Promise<BuildIndexResult> {
  const workspace = await getWorkspace(workspaceId);
  const existing = await readWorkspaceIndex(workspaceId);
  const { index, result } = await rebuildWorkspaceIndex(
    workspaceId,
    workspace?.name ?? workspaceId,
    existing,
  );
  await writeRebuiltWorkspaceIndex(index, existing);
  return result;
}
