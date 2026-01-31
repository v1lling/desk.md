import type { ChunkInput } from './types';

/** Size threshold for single chunk vs split (2KB) */
const SINGLE_CHUNK_THRESHOLD = 2048;

/** Target chunk size in characters (~500 tokens) */
const TARGET_CHUNK_SIZE = 2000;

/** Overlap between chunks for context */
const CHUNK_OVERLAP = 200;

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
 * Extract frontmatter from markdown content
 */
export function extractFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  try {
    // Simple YAML parsing for common fields
    const frontmatter: Record<string, unknown> = {};
    const lines = match[1].split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value: unknown = line.slice(colonIndex + 1).trim();
        // Parse booleans
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        frontmatter[key] = value;
      }
    }
    return { frontmatter, body: match[2] };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

/**
 * Check if content should be excluded from AI indexing
 */
export function shouldExclude(frontmatter: Record<string, unknown>): boolean {
  return frontmatter.ai === false || frontmatter.ai === 'false';
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
 * Chunk a document for indexing
 */
export async function chunkDocument(
  content: string,
  docPath: string,
  workspaceId: string,
  contentType: 'doc' | 'task' | 'meeting',
  title: string
): Promise<ChunkInput[]> {
  const { frontmatter, body } = extractFrontmatter(content);

  // Check if excluded
  if (shouldExclude(frontmatter)) {
    return [];
  }

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
      if (section.length > TARGET_CHUNK_SIZE * 1.5) {
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
