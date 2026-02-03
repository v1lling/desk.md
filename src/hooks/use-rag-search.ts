/**
 * Reusable RAG search hook.
 * Extracts RAG search logic for use across AI features (chat, email drafting, etc.)
 */

import { useCallback } from 'react';
import { useRAGStore } from '@/stores/rag';
import { useSettingsStore } from '@/stores/settings';
import { isTauri } from '@/lib/desk';
import * as rag from '@/lib/rag';
import { deduplicateByDocPath } from '@/lib/rag/utils';
import type { QueryContext } from '@/lib/rag/query-preprocessor';
import type { AIRAGResult, AIMessageSource } from '@/lib/ai/types';

// =============================================================================
// Types
// =============================================================================

export interface RAGSearchOptions {
  /** Query to search for (can be preprocessed or raw) */
  query: string;
  /** Optional context for query preprocessing */
  queryContext?: QueryContext;
  /** Override retrieval count (defaults to store setting) */
  retrievalCount?: number;
  /** Override score threshold (defaults to store setting) */
  scoreThreshold?: number;
}

export interface RAGSearchResult {
  /** RAG results with full content for AI context injection */
  ragResults: AIRAGResult[];
  /** Sources for UI display (deduplicated by docPath, sorted by score) */
  sources: AIMessageSource[];
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook that provides RAG search functionality.
 * Returns a search function and availability status.
 *
 * Usage:
 * ```typescript
 * const { search, isAvailable } = useRAGSearch();
 *
 * if (isAvailable) {
 *   const { ragResults, sources } = await search({
 *     query: 'my search query',
 *     queryContext: { projectId, projectName },
 *   });
 * }
 * ```
 */
export function useRAGSearch() {
  // Get RAG settings getter (to avoid stale closures in async functions)
  const getRAGSettings = useCallback(() => {
    const ragState = useRAGStore.getState();
    const settingsState = useSettingsStore.getState();
    return {
      dataPath: settingsState.dataPath,
      embeddingProvider: ragState.embeddingProvider,
      ollamaUrl: ragState.ollamaUrl,
      ollamaModel: ragState.ollamaModel,
      openaiApiKey: ragState.openaiApiKey,
      voyageApiKey: ragState.voyageApiKey,
      retrievalCount: ragState.retrievalCount,
      scoreThreshold: ragState.scoreThreshold,
    };
  }, []);

  // Check if RAG is available (Tauri + dataPath configured)
  const isAvailable = isTauri() && !!useSettingsStore((s) => s.dataPath);

  /**
   * Perform RAG search with the given options.
   * Returns empty results if RAG is unavailable or search fails.
   */
  const search = useCallback(
    async (options: RAGSearchOptions): Promise<RAGSearchResult> => {
      const emptyResult: RAGSearchResult = { ragResults: [], sources: [] };

      // Check availability
      const ragSettings = getRAGSettings();
      if (!isTauri() || !ragSettings.dataPath) {
        return emptyResult;
      }

      try {
        // Build embedding settings
        const embeddingSettings: rag.EmbeddingSettings = {
          provider: ragSettings.embeddingProvider,
          ollamaUrl: ragSettings.ollamaUrl,
          ollamaModel: ragSettings.ollamaModel,
          openaiApiKey: ragSettings.openaiApiKey || undefined,
          voyageApiKey: ragSettings.voyageApiKey || undefined,
        };

        // Use provided overrides or defaults from store
        const retrievalCount = options.retrievalCount ?? ragSettings.retrievalCount;
        const scoreThreshold = options.scoreThreshold ?? ragSettings.scoreThreshold;

        // Perform search
        const results = await rag.search(
          ragSettings.dataPath,
          options.query,
          retrievalCount,
          embeddingSettings
        );

        // Filter by score threshold and map to AIRAGResult
        const ragResults: AIRAGResult[] = results
          .filter((r) => r.score >= scoreThreshold)
          .map((r) => ({
            docPath: r.docPath,
            title: r.title,
            content: r.content,
            contentType: r.contentType,
            score: r.score,
          }));

        // Deduplicate by docPath (keep highest score per doc) and sort by score
        const deduplicated = deduplicateByDocPath(ragResults).sort(
          (a, b) => b.score - a.score
        );

        // Build sources for display
        const sources: AIMessageSource[] = deduplicated
          .map((r) => ({
            docPath: r.docPath,
            title: r.title,
            contentType: r.contentType,
            score: r.score,
          }));

        return { ragResults, sources };
      } catch (error) {
        // Silently fail - RAG is optional enhancement
        console.warn('[useRAGSearch] Search failed:', error);
        return emptyResult;
      }
    },
    [getRAGSettings]
  );

  return { search, isAvailable };
}
