// =============================================================================
// System Prompts (Smart Index / catalog summarization)
// =============================================================================

/**
 * Base context prepended to the summarization prompts — gives the model enough
 * understanding of Desk's structure to write useful file summaries.
 */
export const BASE_CONTEXT = `You are summarizing files for Desk, a local-first project and task management app.
Desk organizes work into workspaces, each containing projects with tasks, documents, and meetings.

Workspace structure:
  projects/{project-id}/tasks/    — task markdown files
  projects/{project-id}/docs/     — human-written documents
  projects/{project-id}/ai-docs/  — AI-generated documents
  projects/{project-id}/meetings/ — meeting note markdown files
  _unassigned/tasks|docs|meetings — items not assigned to a project
  docs/                           — workspace-level human docs
  ai-docs/                        — workspace-level AI docs
Files created by Desk are named YYYY-MM-DD-slug.md, but docs/ may also contain imported files with arbitrary names. Entity type is determined by directory (tasks/, docs/, ai-docs/, meetings/), not filename.`;

/**
 * System prompts for internal operations (indexing/summarization).
 * These are passed directly to AIService.custom().
 */
export const SYSTEM_PROMPTS = {
  /**
   * Auto-summarize document on save
   * Used by: context-index/indexer.ts
   */
  autoSummarize: `Summarize this document in 1-2 sentences. Focus on what information it contains. Return ONLY the summary text, no other formatting.`,

  /**
   * Batch summarize multiple documents during index build
   * Used by: context-index/builder.ts
   */
  batchSummarize: `Summarize each document in 1-2 sentences. Focus on what information it contains. Return ONLY a JSON array of summary strings in the same order as the documents. No other text.`,
} as const;
