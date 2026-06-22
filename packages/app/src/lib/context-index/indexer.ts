/**
 * Context Catalog incremental index updater.
 *
 * Keeps catalog hashes/titles up to date after file saves and optionally
 * refreshes summaries when content changes. Handles both existing entries
 * and brand-new files (added to the catalog on first save).
 */

import { useContextStore } from "@/stores/context";
import { useContextIndexStore } from "@/stores/context-index";
import { hashContent, extractBody } from "@/lib/context-index/content-utils";
import { getAIInclusion } from "@/lib/context-index/aiignore";
import { generatePreview } from "@desk/core";
import { isTauri } from "@desk/core";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { writeWorkspaceContextArtifact } from "@/lib/context-index/artifacts";
import { buildBaseEntry } from "./entry-factory";
import { getSummaryPreviewLength } from "./constants";
import type { IndexEntry } from "./types";

const INDEX_UPDATE_DEBOUNCE_MS = 5000;
const FALLBACK_PREVIEW_LENGTH = 150;

export interface IndexDocOptions {
  path: string;
  content: string;
  workspaceId: string;
  contentType: "doc" | "task" | "meeting";
  title: string;
  projectId: string;
  created: string;
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

    const contentHash = await hashContent(content);
    const existingIndex = useContextIndexStore.getState().getIndex(workspaceId);
    const existingEntry = existingIndex?.entries.find((entry) => entry.filePath === path);
    const isNewEntry = !existingEntry;
    const hashChanged = existingEntry ? existingEntry.contentHash !== contentHash : true;

    // Background task — never prompt. AI summarization stays off until the user has
    // acknowledged the privacy disclosure via a foreground feature.
    const { useAISettingsStore } = await import("@/stores/ai");
    const aiSettings = useAISettingsStore.getState();
    const consentGiven = aiSettings.aiConsentGiven;
    const aiKeyConfigured = aiSettings.providerConfigured[aiSettings.providerType];

    const shouldGenerateSummary =
      contextState.autoSummarizeOnSave && hashChanged && consentGiven && aiKeyConfigured;

    let summary = existingEntry?.summary ?? "";
    let isPreview = existingEntry?.isPreview;

    if (shouldGenerateSummary) {
      try {
        const { createAIService } = await import("@/lib/ai/service");
        const service = createAIService({ providerType: aiSettings.providerType });
        const body = extractBody(content);
        const preview = body.slice(0, getSummaryPreviewLength(contextState.summaryDetail));
        const response = await service.custom(
          SYSTEM_PROMPTS.autoSummarize,
          `Title: ${title}\nType: ${contentType}\n\n${preview}`
        );
        summary = response.message.trim();
        isPreview = false;
      } catch (error) {
        console.warn("[context-index] Failed to regenerate summary:", error);
        // On AI failure: existing entries keep their previous summary. New entries
        // fall back to a plain-text preview so they're at least represented.
        if (isNewEntry) {
          summary = generatePreview(extractBody(content), FALLBACK_PREVIEW_LENGTH);
          isPreview = true;
        }
      }
    } else if (isNewEntry) {
      // New entry without AI (toggle off, no consent, or no key): plain-text preview.
      summary = generatePreview(extractBody(content), FALLBACK_PREVIEW_LENGTH);
      isPreview = true;
    }

    if (isNewEntry) {
      const base = await buildBaseEntry({
        filePath: path,
        workspaceId,
        type: contentType,
        title,
        projectId,
        created,
        content,
      });
      const newEntry: IndexEntry = { ...base, summary };
      if (isPreview !== undefined) newEntry.isPreview = isPreview;
      useContextIndexStore.getState().updateEntry(workspaceId, newEntry);
    } else {
      const updated: IndexEntry = {
        ...existingEntry,
        contentHash,
        title,
        summary,
      };
      if (isPreview !== undefined) updated.isPreview = isPreview;
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
