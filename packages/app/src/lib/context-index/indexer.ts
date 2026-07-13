/**
 * Context Catalog incremental index updater.
 *
 * Keeps catalog hashes/titles up to date after file saves and refreshes the AI
 * summary when content changes and a key is available. New files are added to the
 * catalog on first save (metadata always; summary only when a key exists — no fake
 * text previews). Mirrors the build-time model in builder.ts.
 */

import { useContextStore } from "@/stores/context";
import { useContextIndexStore } from "@/stores/context-index";
import { hashContent, extractBody, buildCatalogEntry } from "@desk/core";
import { getAIInclusion } from "@/lib/context-index/aiignore";
import { isTauri } from "@desk/core";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { writeWorkspaceContextArtifact } from "@/lib/context-index/artifacts";
import { getSummaryPreviewLength } from "./constants";
import type { IndexEntry } from "./types";

const INDEX_UPDATE_DEBOUNCE_MS = 5000;

export interface IndexDocOptions {
  path: string;
  content: string;
  workspaceId: string;
  contentType: "doc" | "task" | "meeting";
  title: string;
  projectId: string;
  created?: string;
}

const pendingIndexes = new Map<string, ReturnType<typeof setTimeout>>();

export function cancelPendingIndex(path: string): void {
  const timeout = pendingIndexes.get(path);
  if (timeout) {
    clearTimeout(timeout);
    pendingIndexes.delete(path);
  }
}

async function performIndex(options: IndexDocOptions): Promise<void> {
  if (!isTauri()) {
    return;
  }

  const contextState = useContextStore.getState();
  const { path, content, workspaceId, contentType, title, projectId, created } = options;

  try {
    const isIncluded = await getAIInclusion(path, workspaceId);
    if (!isIncluded) {
      useContextIndexStore.getState().removeEntry(workspaceId, path);
      return;
    }

    // Hash the body (frontmatter stripped) — must match the catalog builder so
    // summaries reuse correctly across the on-save and full-rebuild paths.
    const contentHash = await hashContent(extractBody(content));
    const existingIndex = useContextIndexStore.getState().getIndex(workspaceId);
    const existingEntry = existingIndex?.entries.find((entry) => entry.filePath === path);
    const hashChanged = existingEntry ? existingEntry.contentHash !== contentHash : true;

    // Background task — never prompt. AI summarization stays off until the user has
    // acknowledged the privacy disclosure via a foreground feature.
    const { useAISettingsStore, useAIUsageStore } = await import("@/stores/ai");
    const aiSettings = useAISettingsStore.getState();
    const consentGiven = aiSettings.aiConsentGiven;
    const aiKeyConfigured = aiSettings.providerConfigured[aiSettings.providerType];

    const shouldGenerateSummary =
      contextState.autoSummarizeOnSave && hashChanged && consentGiven && aiKeyConfigured;

    // Keep the previous summary by default (may be undefined). Without a key the entry
    // is simply represented with metadata and no summary — no fake text preview.
    let summary = existingEntry?.summary;

    if (shouldGenerateSummary) {
      try {
        const { createAIService } = await import("@/lib/ai/service");
        const service = createAIService({
          providerType: aiSettings.providerType,
          onUsage: (usage) =>
            useAIUsageStore
              .getState()
              .addRecord({ purpose: "index", provider: aiSettings.providerType, usage }),
        });
        const body = extractBody(content);
        const preview = body.slice(0, getSummaryPreviewLength(contextState.summaryDetail));
        const response = await service.custom(
          SYSTEM_PROMPTS.autoSummarize,
          `Title: ${title}\nType: ${contentType}\n\n${preview}`
        );
        summary = response.message.trim() || summary;
      } catch (error) {
        console.warn("[context-index] Failed to regenerate summary:", error);
        // Keep the previous summary (may be undefined) — never fabricate one.
      }
    }

    if (!existingEntry) {
      const meta = await buildCatalogEntry({
        filePath: path,
        workspaceId,
        type: contentType,
        title,
        projectId,
        created,
        content,
      });
      const newEntry: IndexEntry = { ...meta };
      if (summary) newEntry.summary = summary;
      useContextIndexStore.getState().updateEntry(workspaceId, newEntry);
    } else {
      const updated: IndexEntry = {
        ...existingEntry,
        contentHash,
        title,
        summary,
      };
      useContextIndexStore.getState().updateEntry(workspaceId, updated);
    }

    const refreshed = useContextIndexStore.getState().getIndex(workspaceId);
    if (refreshed) {
      await writeWorkspaceContextArtifact(refreshed);
    }
  } catch (error) {
    console.error("[context-index] Failed to update catalog entry:", error);
  }
}

export function indexDocumentOnSave(options: IndexDocOptions): void {
  const { path } = options;
  cancelPendingIndex(path);

  const timeout = setTimeout(() => {
    pendingIndexes.delete(path);
    void performIndex(options);
  }, INDEX_UPDATE_DEBOUNCE_MS);

  pendingIndexes.set(path, timeout);
}

export async function indexDocumentImmediate(options: IndexDocOptions): Promise<void> {
  cancelPendingIndex(options.path);
  await performIndex(options);
}

export async function removeFromIndex(docPath: string, workspaceId?: string): Promise<void> {
  cancelPendingIndex(docPath);

  if (!workspaceId) {
    return;
  }

  useContextIndexStore.getState().removeEntry(workspaceId, docPath);
  const updated = useContextIndexStore.getState().getIndex(workspaceId);
  if (updated) {
    await writeWorkspaceContextArtifact(updated);
  }
}
