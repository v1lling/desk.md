/**
 * RAG Indexer
 *
 * Handles automatic RAG indexing after document saves.
 * Uses a longer debounce (5s) than auto-save to avoid excessive API calls
 * while the user is actively typing.
 * Respects .aiignore exclusions.
 */

import { useCallback, useRef, useEffect } from "react";
import { useSettingsStore } from "@/stores/settings";
import { useRAGStore } from "@/stores/rag";
import * as rag from "@/lib/rag";
import { hasProviderConfig } from "@/lib/rag/validation";
import { getAIInclusion } from "@/lib/rag/aiignore";
import { isTauri } from "@/lib/desk";

/**
 * Longer debounce for RAG indexing to avoid expensive API calls
 * while the user is actively typing. 5 seconds after last change.
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
 * Core indexing logic - actually performs the indexing.
 */
async function performIndex(options: IndexDocOptions): Promise<void> {
  const { dataPath } = useSettingsStore.getState();
  const {
    autoIndexOnSave,
    embeddingProvider,
    ollamaUrl,
    ollamaModel,
    openaiApiKey,
    voyageApiKey,
  } = useRAGStore.getState();

  // Skip if auto-index disabled or not in Tauri
  if (!autoIndexOnSave || !isTauri() || !dataPath) {
    return;
  }

  // Build settings early to validate provider config
  const settings: rag.EmbeddingSettings = {
    provider: embeddingProvider,
    ollamaUrl,
    ollamaModel,
    openaiApiKey: openaiApiKey || undefined,
    voyageApiKey: voyageApiKey || undefined,
  };

  // Skip silently if provider is not properly configured
  if (!hasProviderConfig(settings)) {
    return;
  }

  const { path, content, workspaceId, contentType, title } = options;

  try {
    // Check if document is excluded via .aiignore
    const isIncluded = await getAIInclusion(path, workspaceId);
    if (!isIncluded) {
      // Document is excluded - remove from index if it exists
      await rag.deleteDoc(dataPath, path);
      return;
    }

    // Chunk the document
    const chunks = await rag.chunkDocument(
      content,
      path,
      workspaceId,
      contentType,
      title
    );

    // Index the chunks
    await rag.indexChunks(dataPath, chunks, settings);
  } catch (error) {
    // Silently fail - indexing shouldn't break the save flow
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

/**
 * Hook that provides a function to index a single document after save.
 * Use this when you need reactive access to settings.
 */
export function useRAGIndexer() {
  const { dataPath } = useSettingsStore();
  const {
    autoIndexOnSave,
    embeddingProvider,
    ollamaUrl,
    ollamaModel,
    openaiApiKey,
    voyageApiKey,
  } = useRAGStore();

  // Track pending index path for cleanup
  const pendingPathRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingPathRef.current) {
        cancelPendingIndex(pendingPathRef.current);
      }
    };
  }, []);

  const indexDocument = useCallback(
    ({ path, content, workspaceId, contentType, title }: IndexDocOptions) => {
      // Skip if auto-index disabled or not in Tauri
      if (!autoIndexOnSave || !isTauri() || !dataPath) {
        return;
      }

      // Build settings early to validate provider config
      const settings: rag.EmbeddingSettings = {
        provider: embeddingProvider,
        ollamaUrl,
        ollamaModel,
        openaiApiKey: openaiApiKey || undefined,
        voyageApiKey: voyageApiKey || undefined,
      };

      // Skip silently if provider is not properly configured
      if (!hasProviderConfig(settings)) {
        return;
      }

      // Track for cleanup
      pendingPathRef.current = path;

      // Use debounced indexing
      indexDocumentOnSave({ path, content, workspaceId, contentType, title });
    },
    [
      dataPath,
      autoIndexOnSave,
      embeddingProvider,
      ollamaUrl,
      ollamaModel,
      openaiApiKey,
      voyageApiKey,
    ]
  );

  return { indexDocument };
}
