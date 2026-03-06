/**
 * Unified context search hook.
 * Branches on contextStrategy: 'index' | 'rag' | 'none'.
 * Returns the same result shape so the rest of the pipeline works unchanged.
 */

import { useCallback } from "react";
import { useContextStore } from "@/stores/context";
import { useContextIndexStore } from "@/stores/context-index";
import { useSettingsStore } from "@/stores/settings";
import { isTauri } from "@/lib/desk";
import { readTextFile } from "@/lib/desk/tauri-fs";
import { extractBody } from "@/lib/rag/chunker";
import * as rag from "@/lib/rag";
import { deduplicateByDocPath } from "@/lib/rag/utils";
import { selectFiles, type Relevance } from "@/lib/context-index/selector";
import { createAIService } from "@/lib/ai/service";
import { useAISettingsStore } from "@/stores/ai";
import type { AIContextResult, AIMessageSource } from "@/lib/ai/types";

export interface ContextSearchOptions {
  query: string;
  workspaceId?: string;
  retrievalCount?: number;
  scoreThreshold?: number;
}

export interface ContextSearchResult {
  contextResults: AIContextResult[];
  sources: AIMessageSource[];
}

const emptyResult: ContextSearchResult = { contextResults: [], sources: [] };

export function useContextSearch() {
  const isAvailable = isTauri() && !!useSettingsStore((s) => s.dataPath);

  const search = useCallback(
    async (options: ContextSearchOptions): Promise<ContextSearchResult> => {
      const { contextStrategy } = useContextStore.getState();

      if (contextStrategy === "none") {
        return emptyResult;
      }

      if (contextStrategy === "index") {
        return indexSearch(options);
      }

      return embeddingSearch(options);
    },
    []
  );

  return { search, isAvailable };
}

/**
 * Index-based search: select files from catalog, read full content.
 */
async function indexSearch(options: ContextSearchOptions): Promise<ContextSearchResult> {
  const { maxFilesPerQuery, showSourcesInChat } = useContextStore.getState();
  const workspaceId = options.workspaceId ?? useSettingsStore.getState().currentWorkspaceId;

  if (!workspaceId) return emptyResult;

  const index = useContextIndexStore.getState().getIndex(workspaceId);
  if (!index || index.entries.length === 0) return emptyResult;

  // Get AI service for file selection
  const { providerType, anthropicApiKey } = useAISettingsStore.getState();
  const aiService = createAIService({
    providerType,
    apiKey: providerType === "anthropic-api" ? anthropicApiKey : undefined,
  });

  // Step 1: AI selects relevant files with relevance scores
  const selections = await selectFiles(options.query, index, {
    maxFiles: maxFilesPerQuery,
    aiService,
  });

  if (selections.length === 0) return emptyResult;

  // Step 2: Read selected files and build results with relevance scores
  const contextResults: AIContextResult[] = [];
  const relevanceByPath = new Map(selections.map((s) => [s.path, s.relevance]));
  const selectedEntries = index.entries.filter((e) => relevanceByPath.has(e.path));

  for (const entry of selectedEntries) {
    try {
      const content = await readTextFile(entry.filePath);
      const body = extractBody(content);
      const relevance = relevanceByPath.get(entry.path) ?? "high";
      contextResults.push({
        docPath: entry.filePath,
        title: entry.title,
        content: body,
        contentType: entry.type,
        score: relevanceToScore(relevance),
      });
    } catch (error) {
      console.warn(`[context-search] Failed to read ${entry.filePath}:`, error);
    }
  }

  // Build sources for UI with relevance scores
  const sources: AIMessageSource[] = showSourcesInChat
    ? contextResults.map((r) => ({
        docPath: r.docPath,
        title: r.title,
        contentType: r.contentType,
        score: r.score,
      }))
    : [];

  return { contextResults, sources };
}

/**
 * RAG-based search: embedding vector similarity.
 */
async function embeddingSearch(options: ContextSearchOptions): Promise<ContextSearchResult> {
  const contextState = useContextStore.getState();
  const settingsState = useSettingsStore.getState();
  const dataPath = settingsState.dataPath;

  if (!isTauri() || !dataPath) return emptyResult;

  try {
    const embeddingSettings: rag.EmbeddingSettings = {
      provider: contextState.embeddingProvider,
      ollamaUrl: contextState.ollamaUrl,
      ollamaModel: contextState.ollamaModel,
      openaiApiKey: contextState.openaiApiKey || undefined,
      voyageApiKey: contextState.voyageApiKey || undefined,
    };

    const retrievalCount = options.retrievalCount ?? contextState.retrievalCount;
    const scoreThreshold = options.scoreThreshold ?? contextState.scoreThreshold;

    const results = await rag.search(dataPath, options.query, retrievalCount, embeddingSettings);

    const contextResults: AIContextResult[] = results
      .filter((r) => r.score >= scoreThreshold)
      .map((r) => ({
        docPath: r.docPath,
        title: r.title,
        content: r.content,
        contentType: r.contentType,
        score: r.score,
      }));

    const deduplicated = deduplicateByDocPath(contextResults).sort((a, b) => b.score - a.score);

    const sources: AIMessageSource[] = contextState.showSourcesInChat
      ? deduplicated.map((r) => ({
          docPath: r.docPath,
          title: r.title,
          contentType: r.contentType,
          score: r.score,
        }))
      : [];

    return { contextResults, sources };
  } catch (error) {
    console.warn("[context-search] RAG search failed:", error);
    return emptyResult;
  }
}

/** Map relevance label to numeric score */
function relevanceToScore(relevance: Relevance): number {
  switch (relevance) {
    case "high": return 1.0;
    case "medium": return 0.7;
    case "low": return 0.4;
  }
}
