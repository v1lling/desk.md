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
  projects/{project-id}/context/  — the map: evergreen, maintained, co-authored
  projects/{project-id}/tasks/    — task markdown files
  projects/{project-id}/docs/     — records: dated documents
  projects/{project-id}/meetings/ — meeting note markdown files
  _unassigned/tasks|docs|meetings — items not assigned to a project
  context/                        — workspace-level map
  docs/                           — workspace-level records
context/ and docs/ split on lifecycle, not authorship: context/ is the small, current description of how things are (read it first); docs/, tasks/, and meetings/ are dated records that accumulate and are never rewritten. Both the user and AI write both.
Files created by Desk are named YYYY-MM-DD-slug.md, but docs/ may also contain imported files with arbitrary names. Entity type is determined by directory (context/, tasks/, docs/, meetings/), not filename.`;

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

  /**
   * Reconcile a project brief against the records written since it was last touched.
   * Used by: stores/project-brief.ts (Context Refresh)
   *
   * The section ownership stated here is ALSO enforced in code by `mergeAISections`
   * (@desk/core doc-sections.ts), which rebuilds the document from the original's headings
   * and restores any human-owned section the model touches. The prompt exists to make the
   * merge's job easy, not to be the safety mechanism — never rely on it alone.
   */
  refreshBrief: `You are updating the "brief" of a project in Desk — the evergreen map of what this project is and where it stands. You are given the current brief, then the records (tasks, docs, meetings) written or changed since the brief was last touched.

Reconcile the brief with those records. Return the COMPLETE brief as markdown.

Rules:
- Reuse the EXACT same "## " headings, in the same order. Do not rename, add, remove or reorder headings.
- "## What this is" and "## Systems & stack" belong to the user. Reproduce them character for character. They describe intent, which you cannot derive from records.
- "## Current state" — rewrite to describe where the project actually stands now, based on the records. Be concrete and short. No filler.
- "## Decisions" — keep every existing decision exactly as written, then append any new decision the records reveal. Never remove or reword a decision. A decision not mentioned recently is not a decision that was reversed.
- "## Open questions" — rewrite: drop what the records answered, add what they raised.
- Write plainly. No preamble, no commentary, no frontmatter, no code fences around the document. Output only the brief itself.
- If the records reveal nothing new for a section, leave that section as it was.`,
} as const;
