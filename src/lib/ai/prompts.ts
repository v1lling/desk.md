import type { AIPurpose, AIContext } from './types';

// =============================================================================
// System Prompts by Purpose
// =============================================================================

const SYSTEM_PROMPTS: Record<Exclude<AIPurpose, 'custom'>, string> = {
  chat: `You are a helpful assistant for Orbit, a project management app.
Be concise and helpful. When context is provided, use it to give relevant answers.`,

  'draft-email': `You are an email drafting assistant.
Write professional, clear, and concise email responses.
Match the tone of the original email when appropriate.
Output only the email body, no subject line unless asked.`,

  summarize: `You are a summarization assistant.
Provide clear, concise summaries that capture the key points.
Use bullet points for multiple items.
Keep summaries to 3-5 sentences unless asked for more detail.`,

  'find-tasks': `You are a task extraction assistant.
Identify actionable tasks from the provided content.
Format each task on its own line starting with "- [ ] "
Include relevant context but keep task titles concise.
Prioritize by importance if possible.`,

  explain: `You are an explanation assistant.
Explain concepts clearly and concisely.
Use examples when helpful.
Adjust complexity based on the question.`,
};

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
  // Get base system prompt
  let systemPrompt: string;
  if (purpose === 'custom') {
    if (!customSystemPrompt) {
      throw new Error('customSystemPrompt required for custom purpose');
    }
    systemPrompt = customSystemPrompt;
  } else {
    systemPrompt = SYSTEM_PROMPTS[purpose];
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

/**
 * Get the system prompt for a purpose (without context)
 */
export function getSystemPrompt(purpose: Exclude<AIPurpose, 'custom'>): string {
  return SYSTEM_PROMPTS[purpose];
}
