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
