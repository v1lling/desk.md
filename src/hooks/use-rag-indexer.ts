/**
 * RAG / Context Indexer
 *
 * Handles on-save indexing based on the active context strategy.
 * - 'index': Updates content hash in the context index store (no AI call)
 * - 'rag': Chunks and embeds the document (existing RAG flow)
 * - 'none': Skips indexing
 *
 * Called via onSaveComplete callback from useEditorSession.
 * Respects .aiignore exclusions.
 */

import { useSettingsStore } from "@/stores/settings";
import { useContextStore } from "@/stores/context";
import { useContextIndexStore } from "@/stores/context-index";
import { hashContent } from "@/lib/rag/chunker";
import * as rag from "@/lib/rag";
import { hasProviderConfig } from "@/lib/rag/validation";
import { getAIInclusion } from "@/lib/rag/aiignore";
import { isTauri } from "@/lib/desk";

/**
 * Debounce for RAG indexing to avoid excessive API calls
 * if user saves multiple times in quick succession.
 */
const RAG_INDEX_DEBOUNCE_MS = 5000;

export interface IndexDocOptions {
  path: string;
  content: string;
  workspaceId: string;
  contentType: "doc" | "task" | "meeting";
  title: string;
}

// Global debounce map: path -> timeout ID
const pendingIndexes = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Cancel any pending index for a path.
 * Call this when closing an editor to avoid stale indexing.
 */
export function cancelPendingIndex(path: string): void {
  const timeout = pendingIndexes.get(path);
  if (timeout) {
    clearTimeout(timeout);
    pendingIndexes.delete(path);
  }
}

/**
 * Core indexing logic - branches on context strategy.
 */
async function performIndex(options: IndexDocOptions): Promise<void> {
  const { dataPath } = useSettingsStore.getState();
  const contextState = useContextStore.getState();
  const { contextStrategy, autoIndexOnSave } = contextState;

  // Skip if auto-index disabled or not in Tauri
  if (!autoIndexOnSave || !isTauri() || !dataPath) {
    return;
  }

  // Skip if strategy is 'none'
  if (contextStrategy === "none") {
    return;
  }

  const { path, content, workspaceId, contentType, title } = options;

  // Strategy: index — update content hash in context index store (no AI call)
  if (contextStrategy === "index") {
    try {
      const isIncluded = await getAIInclusion(path, workspaceId);
      if (!isIncluded) {
        useContextIndexStore.getState().removeEntry(workspaceId, path);
        return;
      }

      const contentHash = await hashContent(content);
      const existingIndex = useContextIndexStore.getState().getIndex(workspaceId);
      const existingEntry = existingIndex?.entries.find((e) => e.filePath === path);

      if (existingEntry) {
        // Update hash (summary stays stale until next Build Index)
        useContextIndexStore.getState().updateEntry(workspaceId, {
          ...existingEntry,
          contentHash,
          title,
        });
      }
      // If no existing entry, it will be added on next Build Index
    } catch (error) {
      console.error("[context-index] Failed to update entry hash:", error);
    }
    return;
  }

  // Strategy: rag — existing embedding flow
  const {
    embeddingProvider,
    ollamaUrl,
    ollamaModel,
    openaiApiKey,
    voyageApiKey,
  } = contextState;

  const settings: rag.EmbeddingSettings = {
    provider: embeddingProvider,
    ollamaUrl,
    ollamaModel,
    openaiApiKey: openaiApiKey || undefined,
    voyageApiKey: voyageApiKey || undefined,
  };

  if (!hasProviderConfig(settings)) {
    return;
  }

  try {
    const isIncluded = await getAIInclusion(path, workspaceId);
    if (!isIncluded) {
      await rag.deleteDoc(dataPath, path);
      return;
    }

    const chunks = await rag.chunkDocument(content, path, workspaceId, contentType, title);
    await rag.indexChunks(dataPath, chunks, settings);
  } catch (error) {
    console.error("[RAG] Failed to index document:", error);
  }
}

/**
 * Schedule a document for indexing with debounce.
 * Multiple calls within 5 seconds will only trigger one index.
 * This prevents excessive API calls during active typing.
 */
export function indexDocumentOnSave(options: IndexDocOptions): void {
  const { path } = options;

  // Cancel any existing pending index for this path
  cancelPendingIndex(path);

  // Schedule new index
  const timeout = setTimeout(() => {
    pendingIndexes.delete(path);
    performIndex(options);
  }, RAG_INDEX_DEBOUNCE_MS);

  pendingIndexes.set(path, timeout);
}

/**
 * Immediately index a document (bypasses debounce).
 * Use this when explicitly requested, like manual reindex.
 */
export async function indexDocumentImmediate(options: IndexDocOptions): Promise<void> {
  cancelPendingIndex(options.path);
  await performIndex(options);
}

/**
 * Remove a document from the RAG index immediately.
 * Call this when a document is excluded from AI via the toggle.
 */
export async function removeFromIndex(docPath: string): Promise<void> {
  const { dataPath } = useSettingsStore.getState();

  if (!isTauri() || !dataPath) {
    return;
  }

  // Cancel any pending index for this path
  cancelPendingIndex(docPath);

  try {
    await rag.deleteDoc(dataPath, docPath);
  } catch (error) {
    // Silently fail - shouldn't break the exclusion flow
    console.error("[RAG] Failed to remove document from index:", error);
  }
}
