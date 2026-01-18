import matter from "gray-matter";

/**
 * Parse a markdown file with YAML frontmatter
 */
export function parseMarkdown<T>(
  content: string
): { data: T; content: string } {
  const { data, content: body } = matter(content);
  return {
    data: data as T,
    content: body.trim(),
  };
}

/**
 * Serialize data and content back to markdown with frontmatter
 * Automatically removes undefined values to prevent YAML serialization errors
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeMarkdown(
  data: any,
  content: string
): string {
  // Filter out undefined values - gray-matter/YAML can't serialize undefined
  const cleanedData = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );
  return matter.stringify(content, cleanedData);
}

/**
 * Generate a URL-safe slug from a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .substring(0, 50); // Limit length
}

/**
 * Generate a filename for a task/note: YYYY-MM-DD-slug.md
 */
export function generateFilename(title: string, date?: Date): string {
  const d = date || new Date();
  const dateStr = d.toISOString().split("T")[0];
  const slug = slugify(title);
  return `${dateStr}-${slug}.md`;
}

/**
 * Extract ID from filename (remove date prefix and .md extension)
 */
export function filenameToId(filename: string): string {
  return filename.replace(/\.md$/, "");
}

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 */
export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}
