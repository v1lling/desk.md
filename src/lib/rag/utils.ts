/**
 * RAG utility functions.
 */

/**
 * Deduplicate results by docPath, keeping the highest score for each document.
 * Same document can have multiple chunks - we keep only the best-scoring one.
 *
 * @param results - Array of objects with docPath and score properties
 * @returns Deduplicated array with highest score per docPath
 */
export function deduplicateByDocPath<T extends { docPath: string; score: number }>(
  results: T[]
): T[] {
  const bestByPath = new Map<string, T>();

  for (const r of results) {
    const existing = bestByPath.get(r.docPath);
    if (!existing || r.score > existing.score) {
      bestByPath.set(r.docPath, r);
    }
  }

  return Array.from(bestByPath.values());
}
