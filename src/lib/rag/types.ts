/** Chunk to be indexed */
export interface ChunkInput {
  docPath: string;
  workspaceId: string;
  contentType: 'doc' | 'task' | 'meeting';
  title: string;
  content: string;
  contentHash: string;
  chunkIndex: number;
  totalChunks: number;
}

/** Search result from RAG query */
export interface SearchResult {
  docPath: string;
  workspaceId: string;
  contentType: 'doc' | 'task' | 'meeting';
  title: string;
  content: string;
  chunkIndex: number;
  score: number;
}

/** Embedding provider settings */
export interface EmbeddingSettings {
  provider: string;
  ollamaUrl: string;
  ollamaModel: string;
  openaiApiKey?: string;
  voyageApiKey?: string;
}

/** Index status from backend */
export interface IndexStatus {
  documentCount: number;
  chunkCount: number;
  lastIndexedAt: string | null;
  indexSizeBytes: number;
  indexedWithProvider: string | null;
  indexedWithModel: string | null;
  dimensions: number | null;
}

/** Result of indexing operation */
export interface IndexResult {
  indexedCount: number;
  skippedCount: number;
  errorCount: number;
  /** First few error messages for debugging (max 10) */
  errors: string[];
}
