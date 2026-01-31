/**
 * RAG Indexer
 *
 * Handles automatic RAG indexing after document saves.
 * Provides both a standalone function and a hook for flexibility.
 */

import { useCallback } from "react";
import { useSettingsStore } from "@/stores/settings";
import { useRAGStore } from "@/stores/rag";
import * as rag from "@/lib/rag";
import { hasProviderConfig } from "@/lib/rag/validation";
import { isTauri } from "@/lib/desk";

export interface IndexDocOptions {
  path: string;
  content: string;
  workspaceId: string;
  contentType: "doc" | "task" | "meeting";
  title: string;
}

/**
 * Standalone function to index a document.
 * Reads settings from stores directly (for use in callbacks).
 */
export async function indexDocumentOnSave(options: IndexDocOptions): Promise<void> {
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
  // (e.g., openai selected but no API key)
  if (!hasProviderConfig(settings)) {
    return;
  }

  const { path, content, workspaceId, contentType, title } = options;

  try {
    // Chunk the document
    const chunks = await rag.chunkDocument(
      content,
      path,
      workspaceId,
      contentType,
      title
    );

    // If document is excluded (empty chunks), delete from index
    if (chunks.length === 0) {
      await rag.deleteDoc(dataPath, path);
      return;
    }

    // Index the chunks
    await rag.indexChunks(dataPath, chunks, settings);
  } catch (error) {
    // Silently fail - indexing shouldn't break the save flow
    console.error("[RAG] Failed to index document:", error);
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

  const indexDocument = useCallback(
    async ({ path, content, workspaceId, contentType, title }: IndexDocOptions) => {
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

      try {
        // Chunk the document
        const chunks = await rag.chunkDocument(
          content,
          path,
          workspaceId,
          contentType,
          title
        );

        // If document is excluded (empty chunks), delete from index
        if (chunks.length === 0) {
          await rag.deleteDoc(dataPath, path);
          return;
        }

        // Index the chunks
        await rag.indexChunks(dataPath, chunks, settings);
      } catch (error) {
        // Silently fail - indexing shouldn't break the save flow
        console.error("[RAG] Failed to index document:", error);
      }
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
