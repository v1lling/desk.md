/**
 * Query preprocessing for RAG search.
 * Enhances user queries with context to improve retrieval quality.
 */

export interface QueryContext {
  /** Selected workspace ID */
  workspaceId?: string;
  /** Selected workspace name (human-readable) */
  workspaceName?: string;
  /** Selected project ID */
  projectId?: string;
  /** Selected project name (human-readable) */
  projectName?: string;
}

/**
 * Detect content type intent from query keywords.
 * Returns the detected type or undefined if no clear intent.
 */
function detectContentTypeIntent(query: string): 'doc' | 'task' | 'meeting' | undefined {
  const lowerQuery = query.toLowerCase();

  // Task indicators
  if (
    lowerQuery.includes('task') ||
    lowerQuery.includes('todo') ||
    lowerQuery.includes('to-do') ||
    lowerQuery.includes('action item')
  ) {
    return 'task';
  }

  // Meeting indicators
  if (
    lowerQuery.includes('meeting') ||
    lowerQuery.includes('notes') ||
    lowerQuery.includes('discussion') ||
    lowerQuery.includes('call')
  ) {
    return 'meeting';
  }

  // Doc indicators
  if (
    lowerQuery.includes('doc') ||
    lowerQuery.includes('document') ||
    lowerQuery.includes('documentation') ||
    lowerQuery.includes('readme') ||
    lowerQuery.includes('guide')
  ) {
    return 'doc';
  }

  return undefined;
}

/**
 * Preprocess a query by adding context that helps RAG find better matches.
 *
 * Since indexed chunks contain:
 * ```
 * # {Title}
 * Location: {path}
 * Type: {doc|task|meeting}
 * ```
 *
 * Adding matching context to the query pushes embeddings closer together.
 *
 * @param query - The user's original query
 * @param context - Optional context (selected project/workspace)
 * @returns Enhanced query string
 */
export function preprocessQuery(query: string, context?: QueryContext): string {
  const parts: string[] = [];

  // 1. Add project context if provided
  if (context?.projectName) {
    // This helps match chunks in that project's path
    parts.push(`Project: ${context.projectName}`);
  }

  // 2. Add workspace context if provided (and no project selected)
  if (context?.workspaceName && !context.projectName) {
    parts.push(`Workspace: ${context.workspaceName}`);
  }

  // 3. Detect and add content type intent
  const contentType = detectContentTypeIntent(query);
  if (contentType) {
    parts.push(`Type: ${contentType}`);
  }

  // 4. Add the original query
  parts.push(query);

  return parts.join('\n');
}

// =============================================================================
// Email-Specific Preprocessing
// =============================================================================

export interface EmailQueryOptions {
  /** Email subject line */
  subject: string;
  /** Email body text */
  body: string;
  /** Sender's name (optional) */
  fromName?: string;
  /** User's reply instructions (optional) */
  instructions?: string;
  /** Project/workspace context for scoping */
  queryContext?: QueryContext;
}

/**
 * Extract key phrases from email body for RAG query.
 * Avoids overwhelming the query with full email text.
 */
function extractEmailKeyPhrases(body: string, maxLength: number = 200): string {
  // Clean up the body
  const cleaned = body
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // If short enough, use as-is
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Take first paragraph or first N characters
  const firstParagraph = cleaned.split('\n\n')[0];
  if (firstParagraph.length <= maxLength) {
    return firstParagraph;
  }

  // Truncate at word boundary
  const truncated = cleaned.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
}

/**
 * Build a prequery optimized for finding context relevant to email drafting.
 * Emphasizes finding meeting notes, project docs, and prior communications.
 *
 * The query is structured to guide RAG toward:
 * - Meeting notes (prior discussions with client)
 * - Project docs (specs, requirements, agreements)
 * - Scoped to the selected project
 *
 * @param options - Email details and context
 * @returns Enhanced query string for RAG search
 */
export function buildEmailPrequery(options: EmailQueryOptions): string {
  const parts: string[] = [];

  // 1. Project/workspace context (most important for scope)
  if (options.queryContext?.projectName) {
    parts.push(`Project: ${options.queryContext.projectName}`);
  } else if (options.queryContext?.workspaceName) {
    parts.push(`Client: ${options.queryContext.workspaceName}`);
  }

  // 2. Prefer meeting notes and docs for email context
  parts.push('Type: meeting doc');

  // 3. Add email subject as topic (often contains project/topic info)
  if (options.subject) {
    // Remove Re: Fwd: prefixes
    const cleanSubject = options.subject
      .replace(/^(Re:|Fwd:|Fw:|AW:|WG:)\s*/gi, '')
      .trim();
    if (cleanSubject) {
      parts.push(`Topic: ${cleanSubject}`);
    }
  }

  // 4. Add user's instructions if they mention specific topics
  if (options.instructions) {
    parts.push(`Looking for: ${options.instructions}`);
  }

  // 5. Add key phrases from email body (truncated)
  const bodyContext = extractEmailKeyPhrases(options.body);
  if (bodyContext) {
    parts.push(`Email context: ${bodyContext}`);
  }

  return parts.join('\n');
}
