/**
 * Re-indexing functionality for RAG
 *
 * Collects all documents, tasks, and meetings across workspaces
 * and indexes them with the configured embedding provider.
 */

import { isTauri } from "@/lib/desk";
import * as desk from "@/lib/desk";
import { chunkDocument } from "./chunker";
import { initDb, indexChunks, clearIndex } from "./index";
import { validateSettings } from "./validation";
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
  totalDocuments: number;
  indexedChunks: number;
  skippedChunks: number;
  errorChunks: number;
  workspacesProcessed: number;
  /** Document paths that failed to chunk */
  failedPaths: string[];
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
      skippedChunks: 0,
      errorChunks: 0,
      workspacesProcessed: 0,
      failedPaths: [],
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
    skippedChunks: 0,
    errorChunks: 0,
    workspacesProcessed: 0,
    failedPaths: [],
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
        documentsProcessed++;
      } catch (error) {
        console.error(`[RAG] Failed to chunk doc ${doc.id}:`, error);
        result.failedPaths.push(doc.filePath);
        documentsProcessed++;
      }
    }

    // Process tasks
    for (const task of tasks) {
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
        documentsProcessed++;
      } catch (error) {
        console.error(`[RAG] Failed to chunk task ${task.id}:`, error);
        result.failedPaths.push(task.filePath);
        documentsProcessed++;
      }
    }

    // Process meetings
    for (const meeting of meetings) {
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
        documentsProcessed++;
      } catch (error) {
        console.error(`[RAG] Failed to chunk meeting ${meeting.id}:`, error);
        result.failedPaths.push(meeting.filePath);
        documentsProcessed++;
      }
    }

    // Index all chunks for this workspace
    if (allChunks.length > 0) {
      try {
        const indexResult: IndexResult = await indexChunks(dataPath, allChunks, settings);
        result.indexedChunks += indexResult.indexedCount;
        result.skippedChunks += indexResult.skippedCount;
        result.errorChunks += indexResult.errorCount;
      } catch (error) {
        console.error(`[RAG] Failed to index workspace ${workspace.id}:`, error);
        result.errorChunks += allChunks.length;
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
