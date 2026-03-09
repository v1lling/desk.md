import type { AIContextResult, AIMessage } from './types';

interface DedupResult {
  /** Context results not yet seen in conversation history */
  results: AIContextResult[];
  /** Titles of files that were already sent in previous turns */
  previousTitles: string[];
}

/**
 * Filter out context results that were already included in earlier conversation turns.
 * Uses `docPath` from message sources to identify previously-sent files.
 * Returns filtered results + titles of excluded files (for a brief AI note).
 */
export function deduplicateContext(
  contextResults: AIContextResult[],
  history: AIMessage[]
): DedupResult {
  const seenPaths = new Set<string>();

  for (const msg of history) {
    if (msg.sources) {
      for (const source of msg.sources) {
        seenPaths.add(source.docPath);
      }
    }
  }

  if (seenPaths.size === 0) {
    return { results: contextResults, previousTitles: [] };
  }

  const results: AIContextResult[] = [];
  const previousTitles: string[] = [];

  for (const r of contextResults) {
    if (seenPaths.has(r.docPath)) {
      previousTitles.push(r.title);
    } else {
      results.push(r);
    }
  }

  return { results, previousTitles };
}
