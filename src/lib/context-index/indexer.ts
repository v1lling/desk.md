/**
 * Context Catalog incremental index updater.
 *
 * Keeps catalog hashes/titles up to date after file saves and optionally
 * refreshes summaries when content changes.
 */

import { useContextStore } from "@/stores/context";
import { useContextIndexStore } from "@/stores/context-index";
import { hashContent, extractBody } from "@/lib/context-index/content-utils";
import { getAIInclusion } from "@/lib/context-index/aiignore";
import { isTauri } from "@/lib/desk";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { writeWorkspaceContextArtifact } from "@/lib/context-index/artifacts";

const INDEX_UPDATE_DEBOUNCE_MS = 5000;

export interface IndexDocOptions {
  path: string;
  content: string;
  workspaceId: string;
  contentType: "doc" | "task" | "meeting";
  title: string;
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
  const { path, content, workspaceId, contentType, title } = options;

  try {
    const isIncluded = await getAIInclusion(path, workspaceId);
    if (!isIncluded) {
      useContextIndexStore.getState().removeEntry(workspaceId, path);
      return;
    }

    const contentHash = await hashContent(content);
    const existingIndex = useContextIndexStore.getState().getIndex(workspaceId);
    const existingEntry = existingIndex?.entries.find((entry) => entry.filePath === path);

    if (!existingEntry) {
      return;
    }

    const hashChanged = existingEntry.contentHash !== contentHash;

    if (contextState.autoSummarizeOnSave && hashChanged) {
      try {
        const { createAIService } = await import("@/lib/ai/service");
        const { useAISettingsStore } = await import("@/stores/ai");

        const aiSettings = useAISettingsStore.getState();
        const service = createAIService({ providerType: aiSettings.providerType });

        const body = extractBody(content);
        const preview = body.slice(0, 500);
        const response = await service.custom(
          SYSTEM_PROMPTS.autoSummarize,
          `Title: ${title}\nType: ${contentType}\n\n${preview}`
        );

        useContextIndexStore.getState().updateEntry(workspaceId, {
          ...existingEntry,
          contentHash,
          title,
          summary: response.message.trim(),
        });
      } catch (error) {
        console.warn("[context-index] Failed to regenerate summary:", error);
        useContextIndexStore.getState().updateEntry(workspaceId, {
          ...existingEntry,
          contentHash,
          title,
        });
      }
    } else {
      useContextIndexStore.getState().updateEntry(workspaceId, {
        ...existingEntry,
        contentHash,
        title,
      });
    }

    const updated = useContextIndexStore.getState().getIndex(workspaceId);
    if (updated) {
      await writeWorkspaceContextArtifact(updated);
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
