/**
 * Context Index Builder
 *
 * Walks all docs/tasks/meetings in a workspace, computes content hashes,
 * reuses existing summaries for unchanged files, and batches new/changed
 * files for AI summarization.
 */

import { isTauri } from "@desk/core";
import * as desk from "@desk/core";
import { getWorkspacePath } from "@desk/core";
import { extractBody } from "@/lib/context-index/content-utils";
import { loadAIIgnoreEntries, isPathExcludedByAIIgnore } from "@/lib/context-index/aiignore";
import { generatePreview } from "@desk/core";
import { createAIService } from "@/lib/ai/service";
import { useAISettingsStore } from "@/stores/ai";
import { useContextStore } from "@/stores/context";
import { SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import { buildBaseEntry } from "./entry-factory";
import { getSummaryPreviewLength } from "./constants";
import type {
  IndexEntry,
  WorkspaceIndex,
  BuildIndexProgress,
  BuildIndexResult,
} from "./types";

const SUMMARY_BATCH_SIZE = 10;

/**
 * Build an index entry from a file item (without summary - that's done in batch).
 */
async function buildEntryFromItem(
  item: { filePath: string; title: string; content: string; created: string; projectId: string },
  type: "doc" | "ai-doc" | "task" | "meeting",
  workspaceId: string,
  extra?: { status?: string; priority?: string; date?: string; projectName?: string }
): Promise<IndexEntry> {
  const base = await buildBaseEntry({
    filePath: item.filePath,
    workspaceId,
    type,
    title: item.title,
    projectId: item.projectId,
    created: item.created,
    content: item.content,
  });

  return {
    ...base,
    projectName: extra?.projectName,
    status: extra?.status,
    priority: extra?.priority,
    date: extra?.date,
  };
}

/**
 * Summarize a batch of entries using AI.
 */
async function summarizeBatch(
  entries: IndexEntry[],
  contents: Map<string, string>
): Promise<void> {
  // Fill any entry that still lacks a summary with a plain text preview.
  const fillPreviews = () => {
    for (const entry of entries) {
      if (!entry.summary) {
        const body = contents.get(entry.filePath) ?? "";
        entry.summary = generatePreview(body, 150);
        entry.isPreview = true;
      }
    }
  };

  const { providerType, providerConfigured } = useAISettingsStore.getState();

  // No AI provider configured — build a keyless catalog with text-preview
  // summaries. Skips a guaranteed-to-fail API call (and its console noise).
  if (!providerConfigured[providerType]) {
    fillPreviews();
    return;
  }

  const service = createAIService({ providerType });

  // Build prompt
  const previewLength = getSummaryPreviewLength(useContextStore.getState().summaryDetail);
  const docs = entries.map((entry, i) => {
    const body = contents.get(entry.filePath) ?? "";
    const preview = body.slice(0, previewLength);
    return `${i + 1}. [${entry.path}] Title: ${entry.title} | Type: ${entry.type}\n${preview}`;
  });

  try {
    const response = await service.custom(SYSTEM_PROMPTS.batchSummarize, `Documents:\n${docs.join("\n\n")}`);

    // Parse JSON array from response
    const text = response.message.trim();
    // Try to find a JSON array in the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const summaries: string[] = JSON.parse(jsonMatch[0]);
      for (let i = 0; i < Math.min(summaries.length, entries.length); i++) {
        entries[i].summary = summaries[i] || "";
      }
      return;
    }
  } catch (error) {
    console.warn("[context-index] AI summarization failed, using preview fallback:", error);
  }

  // Fallback: use generatePreview for entries without summaries
  fillPreviews();
}

/**
 * Build a workspace index, with incremental rebuild support.
 */
export async function buildWorkspaceIndex(
  workspaceId: string,
  workspaceName: string,
  existingIndex?: WorkspaceIndex,
  onProgress?: (progress: BuildIndexProgress) => void
): Promise<{ index: WorkspaceIndex; result: BuildIndexResult }> {
  const result: BuildIndexResult = {
    totalFiles: 0,
    summarized: 0,
    reused: 0,
    excluded: 0,
    errors: [],
  };

  if (!isTauri()) {
    return {
      index: { workspaceId, workspaceName, entries: [], builtAt: new Date().toISOString(), fileCount: 0 },
      result,
    };
  }

  // Build a map of existing entries by path for incremental rebuild
  const existingEntries = new Map<string, IndexEntry>();
  if (existingIndex) {
    for (const entry of existingIndex.entries) {
      existingEntries.set(entry.path, entry);
    }
  }

  // Load .aiignore
  const aiignoreEntries = await loadAIIgnoreEntries(workspaceId);
  const workspacePath = await getWorkspacePath(workspaceId);

  const isExcluded = (filePath: string): boolean => {
    const normalizedFile = filePath.replace(/\\/g, "/");
    const normalizedWorkspace = workspacePath.replace(/\\/g, "/");
    const relativePath = normalizedFile.startsWith(normalizedWorkspace)
      ? normalizedFile.slice(normalizedWorkspace.length).replace(/^\//, "")
      : normalizedFile;
    return isPathExcludedByAIIgnore(relativePath, aiignoreEntries);
  };

  // Resolve project names
  const projects = await desk.getProjects(workspaceId);
  const projectNameMap = new Map(projects.map((p) => [p.id, p.name]));

  // Collect all files
  onProgress?.({ phase: "collecting", total: 0, processed: 0, newOrChanged: 0, currentWorkspace: workspaceName });

  const [docs, aiDocs, tasks, meetings] = await Promise.all([
    desk.getAllDocsForWorkspace(workspaceId, "human"),
    desk.getAllDocsForWorkspace(workspaceId, "ai"),
    desk.getTasks(workspaceId),
    desk.getMeetings(workspaceId),
  ]);

  const allEntries: IndexEntry[] = [];
  const needsSummarization: IndexEntry[] = [];
  const contentMap = new Map<string, string>(); // filePath -> body content

  const totalFiles = docs.length + aiDocs.length + tasks.length + meetings.length;

  // Process docs (human)
  for (const doc of docs) {
    if (isExcluded(doc.filePath)) {
      result.excluded++;
      continue;
    }
    try {
      const entry = await buildEntryFromItem(doc, "doc", workspaceId, {
        projectName: projectNameMap.get(doc.projectId),
      });
      const existing = existingEntries.get(entry.path);
      if (existing && existing.contentHash === entry.contentHash && existing.summary && !existing.isPreview) {
        entry.summary = existing.summary;
        result.reused++;
      } else {
        contentMap.set(doc.filePath, extractBody(doc.content));
        needsSummarization.push(entry);
      }
      allEntries.push(entry);
    } catch (error) {
      result.errors.push(`Doc ${doc.id}: ${String(error)}`);
    }
  }

  // Process AI docs
  for (const doc of aiDocs) {
    if (isExcluded(doc.filePath)) {
      result.excluded++;
      continue;
    }
    try {
      const entry = await buildEntryFromItem(doc, "ai-doc", workspaceId, {
        projectName: projectNameMap.get(doc.projectId),
      });
      const existing = existingEntries.get(entry.path);
      if (existing && existing.contentHash === entry.contentHash && existing.summary && !existing.isPreview) {
        entry.summary = existing.summary;
        result.reused++;
      } else {
        contentMap.set(doc.filePath, extractBody(doc.content));
        needsSummarization.push(entry);
      }
      allEntries.push(entry);
    } catch (error) {
      result.errors.push(`AI Doc ${doc.id}: ${String(error)}`);
    }
  }

  // Process tasks
  for (const task of tasks) {
    if (isExcluded(task.filePath)) {
      result.excluded++;
      continue;
    }
    try {
      const entry = await buildEntryFromItem(task, "task", workspaceId, {
        status: task.status,
        priority: task.priority,
        projectName: projectNameMap.get(task.projectId),
      });
      const existing = existingEntries.get(entry.path);
      if (existing && existing.contentHash === entry.contentHash && existing.summary && !existing.isPreview) {
        entry.summary = existing.summary;
        result.reused++;
      } else {
        contentMap.set(task.filePath, extractBody(task.content));
        needsSummarization.push(entry);
      }
      allEntries.push(entry);
    } catch (error) {
      result.errors.push(`Task ${task.id}: ${String(error)}`);
    }
  }

  // Process meetings
  for (const meeting of meetings) {
    if (isExcluded(meeting.filePath)) {
      result.excluded++;
      continue;
    }
    try {
      const entry = await buildEntryFromItem(meeting, "meeting", workspaceId, {
        date: meeting.date,
        projectName: projectNameMap.get(meeting.projectId),
      });
      const existing = existingEntries.get(entry.path);
      if (existing && existing.contentHash === entry.contentHash && existing.summary && !existing.isPreview) {
        entry.summary = existing.summary;
        result.reused++;
      } else {
        contentMap.set(meeting.filePath, extractBody(meeting.content));
        needsSummarization.push(entry);
      }
      allEntries.push(entry);
    } catch (error) {
      result.errors.push(`Meeting ${meeting.id}: ${String(error)}`);
    }
  }

  // Summarize new/changed files in batches
  onProgress?.({
    phase: "summarizing",
    total: needsSummarization.length,
    processed: 0,
    newOrChanged: needsSummarization.length,
    currentWorkspace: workspaceName,
  });

  for (let i = 0; i < needsSummarization.length; i += SUMMARY_BATCH_SIZE) {
    const batch = needsSummarization.slice(i, i + SUMMARY_BATCH_SIZE);
    try {
      await summarizeBatch(batch, contentMap);
      result.summarized += batch.length;
    } catch (error) {
      console.error("[context-index] Batch summarization failed:", error);
      // Use preview fallback for failed batch
      for (const entry of batch) {
        const body = contentMap.get(entry.filePath) ?? "";
        entry.summary = generatePreview(body, 150);
        entry.isPreview = true;
      }
      result.summarized += batch.length;
      result.errors.push(`Batch ${Math.floor(i / SUMMARY_BATCH_SIZE)}: ${String(error)}`);
    }

    onProgress?.({
      phase: "summarizing",
      total: needsSummarization.length,
      processed: Math.min(i + SUMMARY_BATCH_SIZE, needsSummarization.length),
      newOrChanged: needsSummarization.length,
      currentWorkspace: workspaceName,
    });
  }

  result.totalFiles = allEntries.length;

  const index: WorkspaceIndex = {
    workspaceId,
    workspaceName,
    entries: allEntries,
    builtAt: new Date().toISOString(),
    fileCount: allEntries.length,
  };

  onProgress?.({
    phase: "done",
    total: totalFiles,
    processed: totalFiles,
    newOrChanged: needsSummarization.length,
    currentWorkspace: workspaceName,
  });

  return { index, result };
}