/**
 * Context Index Builder — the AI summary enrichment pass.
 *
 * The always-complete metadata catalog is built in @desk/core (and, in hosted mode,
 * on the server) via `getDeskService().buildWorkspaceCatalog`. This module layers AI
 * summaries on top: it reuses existing summaries for unchanged files (by contentHash)
 * and batches new/changed files for AI summarization. No AI key → entries simply keep
 * `summary` undefined (no fake text-preview).
 */

import { getDeskService, extractBody } from "@desk/core";
import { createAIService } from "@/lib/ai/service";
import { useAISettingsStore, useAIUsageStore } from "@/stores/ai";
import { useContextStore } from "@/stores/context";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { getSummaryPreviewLength } from "./constants";
import type {
  IndexEntry,
  WorkspaceIndex,
  BuildIndexProgress,
  BuildIndexResult,
} from "./types";

const SUMMARY_BATCH_SIZE = 10;

/**
 * Summarize a batch of entries using AI, writing `summary` in place. Entries that the
 * AI doesn't return (or on failure) are left with `summary` undefined.
 */
async function summarizeBatch(
  entries: IndexEntry[],
  contents: Map<string, string>
): Promise<void> {
  const { providerType } = useAISettingsStore.getState();

  const service = createAIService({
    providerType,
    onUsage: (usage) =>
      useAIUsageStore.getState().addRecord({ purpose: "index", provider: providerType, usage }),
  });

  const previewLength = getSummaryPreviewLength(useContextStore.getState().summaryDetail);
  const docs = entries.map((entry, i) => {
    const body = contents.get(entry.filePath) ?? "";
    const preview = body.slice(0, previewLength);
    return `${i + 1}. [${entry.path}] Title: ${entry.title} | Type: ${entry.type}\n${preview}`;
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
 * Build a workspace index: the always-complete metadata catalog (from core / the
 * server) enriched with AI summaries (where a key exists), reusing unchanged summaries.
 */
export async function buildWorkspaceIndex(
  workspaceId: string,
  workspaceName: string,
  existingIndex?: WorkspaceIndex,
  onProgress?: (progress: BuildIndexProgress) => void
): Promise<{ index: WorkspaceIndex; result: BuildIndexResult }> {
  const result: BuildIndexResult = {
    totalFiles: 0,
    summarized: 0,
    reused: 0,
    excluded: 0,
    errors: [],
  };

  onProgress?.({ phase: "collecting", total: 0, processed: 0, newOrChanged: 0, currentWorkspace: workspaceName });

  // Metadata catalog: always complete, AI-free, .aiignore already applied. In hosted /
  // native-remote mode this builds the *server's* catalog in one round-trip.
  const deskService = getDeskService();
  const catalog = await deskService.buildWorkspaceCatalog(workspaceId);
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

  // Only summarize when a key is configured; otherwise leave summaries undefined and
  // ship the complete metadata catalog as-is.
  const { providerType, providerConfigured } = useAISettingsStore.getState();
  const canSummarize = providerConfigured[providerType];

  if (canSummarize && needsSummarization.length > 0) {
    // Fetch raw content and strip frontmatter (extractBody) so the AI summarizes body
    // text, not YAML. Four bulk reads, keyed by absolute filePath to match catalog entries.
    const [docs, aiDocs, tasks, meetings] = await Promise.all([
      deskService.getAllDocsForWorkspace(workspaceId, "human"),
      deskService.getAllDocsForWorkspace(workspaceId, "ai"),
      deskService.getTasks(workspaceId),
      deskService.getMeetings(workspaceId),
    ]);
    const contentMap = new Map<string, string>();
    for (const item of [...docs, ...aiDocs, ...tasks, ...meetings]) {
      contentMap.set(item.filePath, extractBody(item.content));
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
        await summarizeBatch(batch, contentMap);
        result.summarized += batch.filter((e) => e.summary).length;
      } catch (error) {
        console.warn("[context-index] Batch summarization failed:", error);
        result.errors.push(`Batch ${Math.floor(i / SUMMARY_BATCH_SIZE)}: ${String(error)}`);
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
