import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/desk';
import type {
  ChunkInput,
  SearchResult,
  EmbeddingSettings,
  IndexStatus,
  IndexResult,
} from './types';

export * from './types';
export * from './chunker';
export * from './aiignore';
export * from './reindex';

/**
 * Convert frontend camelCase to backend snake_case for ChunkInput
 */
function toBackendChunk(chunk: ChunkInput): Record<string, unknown> {
  return {
    doc_path: chunk.docPath,
    workspace_id: chunk.workspaceId,
    content_type: chunk.contentType,
    title: chunk.title,
    content: chunk.content,
    content_hash: chunk.contentHash,
    chunk_index: chunk.chunkIndex,
    total_chunks: chunk.totalChunks,
  };
}

/**
 * Convert frontend settings to backend format
 */
function toBackendSettings(settings: EmbeddingSettings): Record<string, unknown> {
  return {
    provider: settings.provider,
    ollama_url: settings.ollamaUrl,
    ollama_model: settings.ollamaModel,
    openai_api_key: settings.openaiApiKey || null,
    voyage_api_key: settings.voyageApiKey || null,
  };
}

/**
 * Convert backend snake_case to frontend camelCase for IndexStatus
 */
function fromBackendStatus(status: Record<string, unknown>): IndexStatus {
  return {
    documentCount: status.document_count as number,
    chunkCount: status.chunk_count as number,
    lastIndexedAt: status.last_indexed_at as string | null,
    indexSizeBytes: status.index_size_bytes as number,
    indexedWithProvider: status.indexed_with_provider as string | null,
    indexedWithModel: status.indexed_with_model as string | null,
    dimensions: status.dimensions as number | null,
  };
}

/**
 * Convert backend search result to frontend format
 */
function fromBackendResult(result: Record<string, unknown>): SearchResult {
  return {
    docPath: result.doc_path as string,
    workspaceId: result.workspace_id as string,
    contentType: result.content_type as 'doc' | 'task' | 'meeting',
    title: result.title as string,
    content: result.content as string,
    chunkIndex: result.chunk_index as number,
    score: result.score as number,
  };
}

/**
 * Initialize the RAG database
 */
export async function initDb(dataPath: string, provider: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('rag_init_db', { dataPath, provider });
}

/**
 * Get index status
 */
export async function getStatus(dataPath: string): Promise<IndexStatus> {
  if (!isTauri()) {
    return {
      documentCount: 0,
      chunkCount: 0,
      lastIndexedAt: null,
      indexSizeBytes: 0,
      indexedWithProvider: null,
      indexedWithModel: null,
      dimensions: null,
    };
  }

  const status = await invoke<Record<string, unknown>>('rag_get_status', { dataPath });
  return fromBackendStatus(status);
}

/**
 * Clear the entire index
 */
export async function clearIndex(dataPath: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('rag_clear_index', { dataPath });
}

/**
 * Delete a single document from the index
 */
export async function deleteDoc(dataPath: string, docPath: string): Promise<void> {
  if (!isTauri()) return;
  await invoke('rag_delete_doc', { dataPath, docPath });
}

/**
 * Check if Ollama is available
 */
export async function checkOllama(url: string): Promise<boolean> {
  if (!isTauri()) {
    // In browser, try direct fetch
    try {
      const response = await fetch(`${url}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  return invoke<boolean>('rag_check_ollama', { url });
}

/**
 * Index chunks with embeddings
 */
export async function indexChunks(
  dataPath: string,
  chunks: ChunkInput[],
  settings: EmbeddingSettings
): Promise<IndexResult> {
  if (!isTauri()) {
    return { indexedCount: 0, skippedCount: 0, errorCount: 0 };
  }

  const result = await invoke<Record<string, unknown>>('rag_index_chunks', {
    dataPath,
    chunks: chunks.map(toBackendChunk),
    settings: toBackendSettings(settings),
  });

  return {
    indexedCount: result.indexed_count as number,
    skippedCount: result.skipped_count as number,
    errorCount: result.error_count as number,
  };
}

/**
 * Search for similar chunks
 */
export async function search(
  dataPath: string,
  query: string,
  limit: number,
  settings: EmbeddingSettings
): Promise<SearchResult[]> {
  if (!isTauri()) {
    return [];
  }

  const results = await invoke<Record<string, unknown>[]>('rag_search', {
    dataPath,
    query,
    limit,
    settings: toBackendSettings(settings),
  });

  return results.map(fromBackendResult);
}
