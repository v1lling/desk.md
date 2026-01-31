/**
 * Re-indexing functionality for RAG
 *
 * Collects all documents, tasks, and meetings across workspaces
 * and indexes them with the configured embedding provider.
 * Respects .aiignore files at workspace level for exclusions.
 */

import { isTauri } from "@/lib/desk";
import * as desk from "@/lib/desk";
import { getWorkspacePath } from "@/lib/desk/paths";
import { chunkDocument } from "./chunker";
import { initDb, indexChunks, clearIndex } from "./index";
import { validateSettings } from "./validation";
import { loadAIIgnoreEntries, isPathExcludedByAIIgnore, toRelativePath } from "./aiignore";
import type { EmbeddingSettings, ChunkInput, IndexResult } from "./types";

export interface ReindexProgress {
  phase: "collecting" | "indexing" | "done";
  workspacesProcessed: number;
  totalWorkspaces: number;
  documentsProcessed: number;
  totalDocuments: number;
  currentWorkspace?: string;
}

export interface ReindexResult {
  /** Documents successfully chunked and indexed */
  totalDocuments: number;
  /** Total chunks indexed */
  indexedChunks: number;
  /** Documents excluded via .aiignore */
  excludedDocuments: number;
  /** Chunks skipped (duplicates, etc.) */
  skippedChunks: number;
  /** Chunks that failed to index */
  errorChunks: number;
  workspacesProcessed: number;
  /** Document paths that failed to chunk */
  failedPaths: string[];
  /** First few error messages from embedding/indexing (max 10) */
  indexErrors: string[];
}

/**
 * Re-index all documents across all workspaces
 */
export async function reindexAll(
  dataPath: string,
  settings: EmbeddingSettings,
  onProgress?: (progress: ReindexProgress) => void
): Promise<ReindexResult> {
  if (!isTauri()) {
    return {
      totalDocuments: 0,
      indexedChunks: 0,
      excludedDocuments: 0,
      skippedChunks: 0,
      errorChunks: 0,
      workspacesProcessed: 0,
      failedPaths: [],
      indexErrors: [],
    };
  }

  // Validate settings before starting
  const validation = validateSettings(settings);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // Initialize database (creates tables if they don't exist)
  await initDb(dataPath, settings.provider);

  // Clear existing index
  await clearIndex(dataPath);

  // Get all workspaces
  const workspaces = await desk.getWorkspaces();

  const result: ReindexResult = {
    totalDocuments: 0,
    indexedChunks: 0,
    excludedDocuments: 0,
    skippedChunks: 0,
    errorChunks: 0,
    workspacesProcessed: 0,
    failedPaths: [],
    indexErrors: [],
  };

  // First pass: count all documents
  let totalDocuments = 0;
  for (const workspace of workspaces) {
    const [docs, tasks, meetings] = await Promise.all([
      desk.getAllDocsForWorkspace(workspace.id),
      desk.getTasks(workspace.id),
      desk.getMeetings(workspace.id),
    ]);
    totalDocuments += docs.length + tasks.length + meetings.length;
  }

  onProgress?.({
    phase: "collecting",
    workspacesProcessed: 0,
    totalWorkspaces: workspaces.length,
    documentsProcessed: 0,
    totalDocuments,
  });

  // Second pass: chunk and index
  let documentsProcessed = 0;

  for (const workspace of workspaces) {
    onProgress?.({
      phase: "indexing",
      workspacesProcessed: result.workspacesProcessed,
      totalWorkspaces: workspaces.length,
      documentsProcessed,
      totalDocuments,
      currentWorkspace: workspace.name,
    });

    // Load .aiignore entries for this workspace
    const aiignoreEntries = await loadAIIgnoreEntries(workspace.id);
    const workspacePath = await getWorkspacePath(workspace.id);

    // Helper to convert absolute path to relative and check if excluded
    const isExcluded = (filePath: string): boolean => {
      const normalizedFile = filePath.replace(/\\/g, "/");
      const normalizedWorkspace = workspacePath.replace(/\\/g, "/");
      const relativePath = normalizedFile.startsWith(normalizedWorkspace)
        ? normalizedFile.slice(normalizedWorkspace.length).replace(/^\//, "")
        : normalizedFile;
      return isPathExcludedByAIIgnore(relativePath, aiignoreEntries);
    };

    // Get all content for this workspace
    const [docs, tasks, meetings] = await Promise.all([
      desk.getAllDocsForWorkspace(workspace.id),
      desk.getTasks(workspace.id),
      desk.getMeetings(workspace.id),
    ]);

    // Collect all chunks for batch indexing
    const allChunks: ChunkInput[] = [];

    // Process docs
    for (const doc of docs) {
      documentsProcessed++;
      if (isExcluded(doc.filePath)) {
        result.excludedDocuments++;
        continue;
      }
      try {
        const chunks = await chunkDocument(
          doc.content,
          doc.filePath,
          workspace.id,
          "doc",
          doc.title
        );
        allChunks.push(...chunks);
        result.totalDocuments++;
      } catch (error) {
        console.error(`[RAG] Failed to chunk doc ${doc.id}:`, error);
        result.failedPaths.push(doc.filePath);
      }
    }

    // Process tasks
    for (const task of tasks) {
      documentsProcessed++;
      if (isExcluded(task.filePath)) {
        result.excludedDocuments++;
        continue;
      }
      try {
        const chunks = await chunkDocument(
          task.content,
          task.filePath,
          workspace.id,
          "task",
          task.title
        );
        allChunks.push(...chunks);
        result.totalDocuments++;
      } catch (error) {
        console.error(`[RAG] Failed to chunk task ${task.id}:`, error);
        result.failedPaths.push(task.filePath);
      }
    }

    // Process meetings
    for (const meeting of meetings) {
      documentsProcessed++;
      if (isExcluded(meeting.filePath)) {
        result.excludedDocuments++;
        continue;
      }
      try {
        const chunks = await chunkDocument(
          meeting.content,
          meeting.filePath,
          workspace.id,
          "meeting",
          meeting.title
        );
        allChunks.push(...chunks);
        result.totalDocuments++;
      } catch (error) {
        console.error(`[RAG] Failed to chunk meeting ${meeting.id}:`, error);
        result.failedPaths.push(meeting.filePath);
      }
    }

    // Index all chunks for this workspace
    if (allChunks.length > 0) {
      try {
        const indexResult: IndexResult = await indexChunks(dataPath, allChunks, settings);
        result.indexedChunks += indexResult.indexedCount;
        result.skippedChunks += indexResult.skippedCount;
        result.errorChunks += indexResult.errorCount;
        // Collect errors (limit to 10 total)
        if (indexResult.errors && result.indexErrors.length < 10) {
          result.indexErrors.push(...indexResult.errors.slice(0, 10 - result.indexErrors.length));
        }
      } catch (error) {
        console.error(`[RAG] Failed to index workspace ${workspace.id}:`, error);
        result.errorChunks += allChunks.length;
        if (result.indexErrors.length < 10) {
          result.indexErrors.push(`Workspace ${workspace.name}: ${String(error)}`);
        }
      }
    }

    result.workspacesProcessed++;
  }

  onProgress?.({
    phase: "done",
    workspacesProcessed: result.workspacesProcessed,
    totalWorkspaces: workspaces.length,
    documentsProcessed,
    totalDocuments,
  });

  return result;
}
