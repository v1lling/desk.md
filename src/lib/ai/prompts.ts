import type { AIPurpose } from './types';

// =============================================================================
// System Prompts
// =============================================================================

/**
 * Base context included in ALL prompts - gives AI understanding of Desk
 */
export const BASE_CONTEXT = `You are a read-only AI assistant for Desk, a local-first project and task management app.
Desk helps users manage multiple workspaces, each containing projects with tasks, documents, and meetings.
You can browse and search workspace data but cannot create, edit, move, or delete any files — including in ai-docs/. Writing to ai-docs/ is done by the user or by external CLI agents; from this assistant, do not offer to "save", "write", or "create" files. If the user asks you to save something, surface the suggested content in chat so they can place it themselves. Be concise, professional, and helpful.

Workspace structure:
  projects/{project-id}/tasks/    — task markdown files
  projects/{project-id}/docs/     — human-written documents
  projects/{project-id}/ai-docs/  — AI-generated documents (read-only from here)
  projects/{project-id}/meetings/ — meeting note markdown files
  _unassigned/tasks|docs|meetings — items not assigned to a project
  docs/                           — workspace-level human docs
  ai-docs/                        — workspace-level AI docs (read-only from here)
Files created by Desk are named YYYY-MM-DD-slug.md, but docs/ may also contain imported files with arbitrary names. Entity type is determined by directory (tasks/, docs/, ai-docs/, meetings/), not filename.`;

/**
 * Shared tool-usage guidance included in all assistant modes.
 */
const TOOL_GUIDE = `Tool usage:
- Call desk_workspace_info FIRST to discover all workspaces and their projects.
- Use desk_tree to browse a workspace's file tree. Without a path argument it returns the COMPLETE tree. If truncated is false, you have everything — don't re-call for subdirectories. File paths contain dates and slugs — for recency or structural queries desk_tree alone is enough.
- Use desk_catalog ONLY when you need content summaries to decide what to read (e.g. "docs about X"). Don't use it for recency or structural queries where desk_tree already answers.
- Use desk_search for literal text/keyword search across file contents.
- Use desk_read to get full file content before making factual claims. Call multiple desk_read in parallel when you need several files.`;

/**
 * Purpose-specific instructions (combined with BASE_CONTEXT)
 */
const PURPOSE_PROMPTS: Record<Exclude<AIPurpose, "custom">, string> = {
  chat: `${TOOL_GUIDE}

Constraints:
- Desk is single-user and local-first. Don't assume assignees, teams, or cloud identities.
- It's likely that Desk is not the only tool the user uses, especially for larger or shared projects. Don't assume all work is in Desk.
- If required metadata is missing, say so plainly and suggest the next actionable step.`,

  "draft-email": `Draft a professional email reply.

- Match the language, tone, greeting, and closing of the original email.
- Be clear and concise. Output ONLY the email body, with no subject line and no headers.
- Plain text only: no markdown bold/italic/headers. Bullet lists and numbered lists are fine.
- If the original email or reply intent is missing, ask one short follow-up before drafting.
- Don't invent sender/recipient names or metadata.

Write like a person, not an AI. Avoid the tells that make text read as machine-generated:
- NEVER use em dashes (—) or en dashes (–). Use commas, periods, parentheses, or just two sentences instead. This is the most important rule.
- No filler openers ("I hope this email finds you well", "I wanted to reach out", "I hope you're doing well").
- No corporate/AI buzzwords: delve, leverage, robust, seamless, streamline, navigate, underscore, utilize, facilitate, furthermore, moreover, additionally, that said.
- No rule-of-three triads ("clear, concise, and effective") or restating what the sender already said back to them.
- No padded enthusiasm, no exclamation-mark filler, no "Hope this helps!" / "Feel free to reach out!" closers unless the original email's tone warrants it.
- Don't over-explain or hedge. Say what's needed and stop. Vary sentence length so it doesn't read as uniform AI prose.

${TOOL_GUIDE}
Use tools when the user asks for workspace context or when referencing docs, tasks, or meetings would genuinely improve the reply.`,
};

/**
 * User-facing AI purposes and their default prompts.
 * The Settings UI iterates this to show each mode's read-only default prompt;
 * labels/descriptions live in i18n (settings.customInstructions.purposes.*).
 */
export const USER_FACING_PROMPTS: Array<{
  purpose: AIPurpose;
  defaultPrompt: string;
}> = [
  { purpose: "chat", defaultPrompt: PURPOSE_PROMPTS.chat },
  { purpose: "draft-email", defaultPrompt: PURPOSE_PROMPTS["draft-email"] },
];

export function getPurposePrompt(purpose: Exclude<AIPurpose, "custom">): string {
  return PURPOSE_PROMPTS[purpose];
}

export type AssistantPromptMode = "chat" | "draft-email";

export interface AssistantPromptBreakdown {
  baseContext: string;
  modePrompt: string;
  userInstructions?: string;
  effectivePrompt: string;
}

export function buildAssistantPromptBreakdown(
  mode: AssistantPromptMode,
  globalInstructions?: string,
  perTypeInstructions?: string
): AssistantPromptBreakdown {
  const today = new Date().toISOString().split('T')[0];
  const baseContext = `Today's date: ${today}.\n\n${BASE_CONTEXT}`;
  const modePrompt = getPurposePrompt(mode);
  const userInstructions = combineInstructions(globalInstructions, perTypeInstructions);

  let effectivePrompt = `${baseContext}\n\n${modePrompt}`;
  if (userInstructions?.trim()) {
    effectivePrompt += `\n\n# User Instructions\n${userInstructions.trim()}`;
  }

  return {
    baseContext,
    modePrompt,
    userInstructions,
    effectivePrompt,
  };
}

export function buildAssistantSystemPrompt(
  mode: AssistantPromptMode,
  globalInstructions?: string,
  perTypeInstructions?: string
): string {
  return buildAssistantPromptBreakdown(mode, globalInstructions, perTypeInstructions).effectivePrompt;
}

interface DraftEmailMessageInput {
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  date?: string;
  source?: string;
  body?: string;
  instructions?: string;
  workspaceId?: string;
  workspaceName?: string;
  projectId?: string;
  projectName?: string;
}

export function buildDraftEmailUserMessage(input?: DraftEmailMessageInput): string {
  const from = input?.from?.trim() || "";
  const to = input?.to?.trim() || "";
  const cc = input?.cc?.trim() || "";
  const subject = input?.subject?.trim() || "";
  const date = input?.date?.trim() || "";
  const source = input?.source?.trim() || "";
  const body = input?.body?.trim() || "";
  const instructions = input?.instructions?.trim() || "";
  const workspaceId = input?.workspaceId?.trim() || "";
  const workspaceName = input?.workspaceName?.trim() || "";
  const projectId = input?.projectId?.trim() || "";
  const projectName = input?.projectName?.trim() || "";

  const headerLines: string[] = [];
  if (from) headerLines.push(`- From: ${from}`);
  if (to) headerLines.push(`- To: ${to}`);
  if (cc) headerLines.push(`- CC: ${cc}`);
  if (subject) headerLines.push(`- Subject: ${subject}`);
  if (date) headerLines.push(`- Date: ${date}`);
  if (source) headerLines.push(`- Source: ${source}`);

  const parts: string[] = [
    "Please draft an email reply using this context.",
  ];

  if (headerLines.length > 0) {
    parts.push("", "Original email metadata:", ...headerLines);
  }

  if (body) {
    parts.push("", "Original email body:", body);
  }

  if (instructions) {
    parts.push("", "Additional instructions:", instructions);
  }

  if (workspaceId || projectId) {
    const hintLines: string[] = [];
    if (workspaceId) {
      hintLines.push(`- Workspace: ${workspaceName || workspaceId} (id: ${workspaceId})`);
    }
    if (projectId) {
      hintLines.push(`- Project: ${projectName || projectId} (id: ${projectId})`);
    }
    const pathHint = workspaceId && projectId
      ? `workspaces/${workspaceId}/projects/${projectId}/`
      : workspaceId
        ? `workspaces/${workspaceId}/`
        : "";
    parts.push(
      "",
      "Context hints:",
      ...hintLines,
      "",
      `If the workspace or project context above is relevant to drafting this reply, use desk_tree / desk_catalog / desk_read to pull supporting docs, tasks, or meeting notes from \`${pathHint}\` before responding. Skip if not relevant.`,
    );
  }

  if (headerLines.length === 0 && !body) {
    parts.push("", "No original email content was provided.");
  }

  return parts.join("\n");
}

interface BuildAssistantTurnUserMessageOptions {
  emailContext?: DraftEmailMessageInput;
}

export function buildAssistantTurnUserMessage(
  options?: BuildAssistantTurnUserMessageOptions
): string {
  return buildDraftEmailUserMessage(options?.emailContext);
}

/**
 * Combine global and per-type user instructions into a single string.
 * Returns undefined if both are empty.
 */
export function combineInstructions(
  globalInstructions: string | undefined,
  perTypeInstructions: string | undefined
): string | undefined {
  const parts: string[] = [];
  if (globalInstructions?.trim()) parts.push(globalInstructions.trim());
  if (perTypeInstructions?.trim()) parts.push(perTypeInstructions.trim());
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

/**
 * System prompts for internal operations (indexing, context search, etc.)
 * These are passed directly to AIService.custom() for batch summarization.
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

