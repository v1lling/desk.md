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
const PURPOSE_PROMPTS: Record<Exclude<AIPurpose, 'custom'>, string> = {
  chat: `Answer questions and help with tasks. When auto-retrieved context is provided, use your judgment about which items are actually relevant to the query. Items are labeled with relevance levels — focus on high-relevance items and only use medium/low-relevance context if it genuinely adds value. Don't force connections to marginally related context.`,

  'draft-email': `Draft a professional email reply.
- Match the greeting and closing style of the original email
- Match the language and tone of the original email
- Be clear and concise
- Output ONLY the email body text, no subject line or headers
- No markdown formatting (no **bold**, *italic*, or headers)
- Bullet points (-) and numbered lists (1. 2. 3.) are fine when appropriate
- Use regular hyphens (-) only, never em dashes (—) or en dashes (–)`,

  summarize: `Summarize the provided content.
- Capture key points clearly
- Use bullet points for multiple items
- Keep to 3-5 sentences unless asked for more detail`,

  'find-tasks': `Extract actionable tasks from the content.
- Format each task on its own line starting with "- [ ] "
- Keep task titles concise but include relevant context
- Prioritize by importance if possible`,

  explain: `Explain the concept or content clearly.
- Use examples when helpful
- Adjust complexity based on the question`,
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
    purpose: 'chat',
    label: 'Chat',
    description: 'General AI chat in the chat panel',
    defaultPrompt: PURPOSE_PROMPTS.chat,
  },
  {
    purpose: 'draft-email',
    label: 'Email Draft',
    description: 'Drafting email replies',
    defaultPrompt: PURPOSE_PROMPTS['draft-email'],
  },
];

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
   * Used by: use-rag-indexer.ts
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
- For tasks, prefer active (doing > todo > waiting > done) and high priority
- For meetings, prefer recent dates
- If no files are relevant, return an empty array []`,
} as const;

/**
 * Get the full system prompt for a purpose (BASE_CONTEXT + PURPOSE_PROMPT)
 */
function getPromptForPurpose(purpose: Exclude<AIPurpose, 'custom'>): string {
  return `${BASE_CONTEXT}\n\n${PURPOSE_PROMPTS[purpose]}`;
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
 * Build the full prompt for a given purpose and context
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
