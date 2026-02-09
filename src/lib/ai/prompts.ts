import type { AIPurpose, AIContext } from './types';

// =============================================================================
// System Prompts
// =============================================================================

/**
 * Base context included in ALL prompts - gives AI understanding of Desk
 */
const BASE_CONTEXT = `You are an AI assistant for Desk, a project management app for freelancers.
Desk helps users manage multiple client workspaces, each containing projects with tasks, documents, and meetings.
Be concise, professional, and helpful.`;

/**
 * Purpose-specific instructions (combined with BASE_CONTEXT)
 */
const PURPOSE_PROMPTS: Record<Exclude<AIPurpose, 'custom'>, string> = {
  chat: `Answer questions and help with tasks. When context (documents, tasks, emails) is provided, use it to give relevant answers.`,

  'draft-email': `Draft a professional email reply on behalf of Sascha Villing.
- Sign as "Sascha Villing" for formal emails, "Sascha" for casual/informal ones (match the sender's formality)
- Match the greeting style to how the sender addressed you (e.g., if they wrote "Hi Sascha", reply with "Hi [Name]")
- For closing: match the sender's style, or use "Liebe Grüße" (German) / "Best regards" (English) as fallback
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
  fileSelector: (maxFiles: number) => `You are a file selector for a work management app. Given a query and a file catalog, return the most relevant file paths as a JSON array.

Rules:
- Return ONLY a JSON array of file paths, nothing else
- Select at most ${maxFiles} files
- Consider the file path hierarchy (workspace/project structure)
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
      .map((r) => `### ${r.title} (${r.contentType})\n${r.content}`)
      .join('\n\n');
    sections.push(`## Relevant Context (auto-retrieved)\n${contextText}`);
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
  customSystemPrompt?: string
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
