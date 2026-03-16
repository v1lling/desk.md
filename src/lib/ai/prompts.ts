import type { AIPurpose, AIContext } from './types';

// =============================================================================
// System Prompts
// =============================================================================

/**
 * Base context included in ALL prompts - gives AI understanding of Desk
 */
export const BASE_CONTEXT = `You are an AI assistant for Desk, a project management app for freelancers.
Desk helps users manage multiple client workspaces, each containing projects with tasks, documents, and meetings.
Be concise, professional, and helpful.`;

/**
 * Purpose-specific instructions (combined with BASE_CONTEXT)
 */
const PURPOSE_PROMPTS: Record<Exclude<AIPurpose, "custom">, string> = {
  chat: `You are Desk Assistant for a local-first project workspace app.

Assistant behavior:
- Use tools to gather context on demand instead of assuming data.
- Use retrieval tools when it helps answer better (e.g. docs, tasks, meetings), but do not call tools when the user request can be answered well without them.
- When file context is needed, call desk_index_search first, then read top candidates with desk_read (usually 1-3, up to 5) before factual claims.
- Treat desk_index_search as candidate ranking, not final evidence.
- Before mutating tools, explain briefly what you are changing.
- If a tool call is rejected, continue with alternatives and ask for confirmation.

Data-model constraints:
- Do not assume assignees, owners, usernames, emails, teams, or cloud account identities unless explicitly present in retrieved Desk content.
- Desk is local-first and typically single-user; avoid asking for a "Desk username".
- If required metadata is missing, say so plainly and suggest the closest actionable next step.`,

  "draft-email": `Draft a professional email reply.
- Tool usage is optional: if project context would improve accuracy (docs, tasks, meetings), you may use retrieval tools; do not fetch extra context when unnecessary.
- Match the greeting and closing style of the original email
- Match the language and tone of the original email
- Be clear and concise
- Output ONLY the email body text, no subject line or headers
- No markdown formatting (no **bold**, *italic*, or headers)
- Bullet points (-) and numbered lists (1. 2. 3.) are fine when appropriate
- Use regular hyphens (-) only, never em dashes or en dashes
- If original email context is missing or too thin, ask one concise follow-up asking the user to paste the original email and desired tone/goal
- Accept raw pasted email text (including forwarded/thread text) and extract relevant context before drafting
- If reply intent (goal/tone/constraints) is not provided yet, ask one concise follow-up before drafting
- Never invent sender/recipient identities or assignment metadata`,
};

/**
 * User-facing AI purposes with display info and default prompts.
 * Used by the Settings UI to show what the AI receives.
 */
export const USER_FACING_PROMPTS: Array<{
  purpose: AIPurpose;
  label: string;
  description: string;
  defaultPrompt: string;
}> = [
  {
    purpose: "chat",
    label: "Assistant",
    description: "General assistant interactions in the Assistant tab",
    defaultPrompt: PURPOSE_PROMPTS.chat,
  },
  {
    purpose: "draft-email",
    label: "Email Draft",
    description: "Drafting email replies via Assistant",
    defaultPrompt: PURPOSE_PROMPTS["draft-email"],
  },
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
  const baseContext = BASE_CONTEXT;
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

  if (headerLines.length === 0 && !body) {
    parts.push("", "No original email content was provided.");
  }

  return parts.join("\n");
}

interface BuildAssistantTurnUserMessageOptions {
  emailContext?: DraftEmailMessageInput;
}

export function buildAssistantTurnUserMessage(
  mode: AssistantPromptMode,
  options?: BuildAssistantTurnUserMessageOptions
): string {
  if (mode === "chat") {
    return "Help me with this workspace.";
  }

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
 * These are used directly with AI service, not through buildPrompt()
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
   * Select relevant files from context index
   * Used by: context-index/selector.ts
   * @param maxFiles - Maximum number of files to select
   */
  fileSelector: (maxFiles: number) => `You are a file selector for a work management app. Given a query and a file catalog, return the most relevant files as a JSON array of objects with "path" and "relevance" fields.

Rules:
- Return ONLY a JSON array, nothing else
- Each item: {"path": "file/path.md", "relevance": "high" | "medium" | "low"}
- Select at most ${maxFiles} files, but prefer fewer high-relevance files over filling the quota with marginal matches
- Only select files that are clearly relevant to the query. If only 2 files match well, return 2 — not ${maxFiles}
- "high": directly answers or is central to the query
- "medium": provides useful background or related context
- "low": only tangentially related
- Consider file path hierarchy (workspace/project structure)
- For tasks, prefer active (todo > doing > waiting > backlog > done) and high priority
- For meetings, prefer recent dates
- If no files are relevant, return an empty array []`,
} as const;

/**
 * Get the full system prompt for a purpose (BASE_CONTEXT + PURPOSE_PROMPT)
 */
function getPromptForPurpose(purpose: Exclude<AIPurpose, "custom">): string {
  return `${BASE_CONTEXT}\n\n${getPurposePrompt(purpose)}`;
}

// =============================================================================
// Context Formatting
// =============================================================================

/** Map numeric score back to relevance label for prompt display */
function scoreToRelevance(score: number): string {
  if (score >= 0.9) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

/**
 * Format context into a string for inclusion in the prompt
 */
export function formatContext(context: AIContext): string {
  const sections: string[] = [];

  if (context.docs && context.docs.length > 0) {
    const docsText = context.docs
      .map((d) => `### ${d.title}\n${d.content}`)
      .join('\n\n');
    sections.push(`## Documents\n${docsText}`);
  }

  if (context.tasks && context.tasks.length > 0) {
    const tasksText = context.tasks
      .map((t) => `- [${t.status === 'done' ? 'x' : ' '}] ${t.title}${t.content ? `\n  ${t.content}` : ''}`)
      .join('\n');
    sections.push(`## Tasks\n${tasksText}`);
  }

  if (context.emails && context.emails.length > 0) {
    const emailsText = context.emails
      .map((e) => `### From: ${e.from}\nSubject: ${e.subject}\n\n${e.body}`)
      .join('\n\n---\n\n');
    sections.push(`## Emails\n${emailsText}`);
  }

  if (context.contextResults && context.contextResults.length > 0) {
    const contextText = context.contextResults
      .map((r) => {
        const relevance = scoreToRelevance(r.score);
        return `### ${r.title} (${r.contentType}, ${relevance} relevance)\n${r.content}`;
      })
      .join('\n\n');
    sections.push(`## Auto-Retrieved Context\nThe following items were automatically retrieved. Focus on high-relevance items; medium/low items are background that may or may not be useful.\n\n${contextText}`);
  }

  if (context.previousContextTitles && context.previousContextTitles.length > 0) {
    sections.push(`## Previously Provided Context\nThese files were included in earlier turns — refer to conversation history for details: ${context.previousContextTitles.join(', ')}`);
  }

  if (context.custom) {
    for (const [key, value] of Object.entries(context.custom)) {
      sections.push(`## ${key}\n${value}`);
    }
  }

  return sections.join('\n\n');
}

// =============================================================================
// Prompt Building
// =============================================================================

export interface BuiltPrompt {
  systemPrompt: string;
  userMessage: string;
}

/**
 * Build the full prompt for a given purpose and context.
 */

export function buildPrompt(
  purpose: AIPurpose,
  message: string,
  context?: AIContext,
  customSystemPrompt?: string,
  userInstructions?: string
): BuiltPrompt {
  // Get system prompt (BASE_CONTEXT + purpose-specific)
  let systemPrompt: string;
  if (purpose === 'custom') {
    if (!customSystemPrompt) {
      throw new Error('customSystemPrompt required for custom purpose');
    }
    // For custom, prepend BASE_CONTEXT to user's prompt
    systemPrompt = `${BASE_CONTEXT}\n\n${customSystemPrompt}`;
  } else {
    systemPrompt = getPromptForPurpose(purpose);
  }

  // Add user's standing instructions if provided
  if (userInstructions?.trim()) {
    systemPrompt += `\n\n# User Instructions\nThe user has provided these standing instructions that should always be followed:\n${userInstructions.trim()}`;
  }

  // Add context to system prompt if provided
  if (context) {
    const contextText = formatContext(context);
    if (contextText) {
      systemPrompt += `\n\n# Context\nUse the following context to inform your response:\n\n${contextText}`;
    }
  }

  return {
    systemPrompt,
    userMessage: message,
  };
}
