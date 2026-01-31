import type { ChunkInput } from './types';

/**
 * Size threshold for single chunk vs split.
 * Documents smaller than this are kept as a single chunk.
 * 2KB chosen because:
 * - Average doc in this codebase is ~1.4KB
 * - Single chunks are more efficient for small docs
 * - Aligns with typical LLM context handling
 */
const SINGLE_CHUNK_THRESHOLD = 2048;

/**
 * Target chunk size in characters (~500 tokens).
 * This balances:
 * - Semantic coherence (enough context per chunk)
 * - Retrieval precision (not too much irrelevant content)
 * - Embedding quality (models optimized for this range)
 */
const TARGET_CHUNK_SIZE = 2000;

/**
 * Overlap between consecutive chunks (in characters).
 * 10% of TARGET_CHUNK_SIZE to:
 * - Preserve context at chunk boundaries
 * - Avoid splitting sentences/concepts
 * - Improve retrieval for queries spanning chunk edges
 */
const CHUNK_OVERLAP = 200;

/**
 * Threshold multiplier for splitting header sections.
 * Header sections larger than TARGET_CHUNK_SIZE * 1.5 are
 * further split by size. The 1.5x buffer prevents over-splitting
 * sections that are only slightly over the target.
 */
const HEADER_SECTION_THRESHOLD = 1.5;

/**
 * Generate SHA-256 hash of content
 */
export async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract body content from markdown (strips frontmatter if present)
 */
export function extractBody(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1] : content;
}

/**
 * Split content by markdown headers (## or ###)
 */
function splitByHeaders(content: string): string[] {
  const sections: string[] = [];
  const lines = content.split('\n');
  let currentSection = '';

  for (const line of lines) {
    if (line.match(/^#{2,3}\s+/)) {
      // New header found
      if (currentSection.trim()) {
        sections.push(currentSection.trim());
      }
      currentSection = line + '\n';
    } else {
      currentSection += line + '\n';
    }
  }

  // Add last section
  if (currentSection.trim()) {
    sections.push(currentSection.trim());
  }

  return sections;
}

/**
 * Split content by fixed size with overlap
 */
function splitBySize(content: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < content.length) {
    let end = start + TARGET_CHUNK_SIZE;

    // Try to break at a paragraph or sentence boundary
    // Use CHUNK_OVERLAP as the search window for finding good break points
    if (end < content.length) {
      const nextParagraph = content.indexOf('\n\n', end - CHUNK_OVERLAP);
      if (nextParagraph > 0 && nextParagraph < end + CHUNK_OVERLAP) {
        end = nextParagraph;
      } else {
        // For sentence boundaries, use half the overlap as search window
        const sentenceWindow = CHUNK_OVERLAP / 2;
        const nextSentence = content.indexOf('. ', end - sentenceWindow);
        if (nextSentence > 0 && nextSentence < end + sentenceWindow) {
          end = nextSentence + 1;
        }
      }
    }

    chunks.push(content.slice(start, end).trim());
    start = end - CHUNK_OVERLAP;
  }

  return chunks.filter(c => c.length > 0);
}

/**
 * Chunk a document for indexing.
 * Note: Exclusion via .aiignore is checked by the caller (reindex/indexer).
 */
export async function chunkDocument(
  content: string,
  docPath: string,
  workspaceId: string,
  contentType: 'doc' | 'task' | 'meeting',
  title: string
): Promise<ChunkInput[]> {
  const body = extractBody(content);
  const contentHash = await hashContent(content);
  const chunks: ChunkInput[] = [];

  // Build context prefix (frontmatter + title for each chunk)
  const contextPrefix = `# ${title}\n\n`;

  if (body.length <= SINGLE_CHUNK_THRESHOLD) {
    // Small file - single chunk
    chunks.push({
      docPath,
      workspaceId,
      contentType,
      title,
      content: contextPrefix + body,
      contentHash,
      chunkIndex: 0,
      totalChunks: 1,
    });
  } else {
    // Large file - split by headers first
    const hasHeaders = body.match(/^#{2,3}\s+/m);
    const sections = hasHeaders ? splitByHeaders(body) : splitBySize(body);

    // If header-split sections are still too large, split by size
    const finalChunks: string[] = [];
    for (const section of sections) {
      if (section.length > TARGET_CHUNK_SIZE * HEADER_SECTION_THRESHOLD) {
        finalChunks.push(...splitBySize(section));
      } else {
        finalChunks.push(section);
      }
    }

    for (let i = 0; i < finalChunks.length; i++) {
      chunks.push({
        docPath,
        workspaceId,
        contentType,
        title,
        content: contextPrefix + finalChunks[i],
        contentHash,
        chunkIndex: i,
        totalChunks: finalChunks.length,
      });
    }
  }

  return chunks;
}

/**
 * Chunk multiple documents
 */
export async function chunkDocuments(
  documents: Array<{
    content: string;
    path: string;
    workspaceId: string;
    contentType: 'doc' | 'task' | 'meeting';
    title: string;
  }>
): Promise<ChunkInput[]> {
  const allChunks: ChunkInput[] = [];

  for (const doc of documents) {
    const chunks = await chunkDocument(
      doc.content,
      doc.path,
      doc.workspaceId,
      doc.contentType,
      doc.title
    );
    allChunks.push(...chunks);
  }

  return allChunks;
}
