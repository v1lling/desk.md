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

// Reserved gray-matter keys that should not be in frontmatter data
const GRAY_MATTER_RESERVED = ["engine", "engines", "language", "delimiters", "excerpt"];

/**
 * Serialize data and content back to markdown with frontmatter
 * Automatically removes undefined values and gray-matter reserved keys
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeMarkdown(
  data: any,
  content: string
): string {
  // Filter out undefined values and gray-matter reserved keys
  const cleanedData = Object.fromEntries(
    Object.entries(data).filter(
      ([key, value]) => value !== undefined && !GRAY_MATTER_RESERVED.includes(key)
    )
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
 * Generate a filename for a task/doc: YYYY-MM-DD-slug.md
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

/**
 * Normalize a date value to YYYY-MM-DD string format
 * Handles Date objects (from gray-matter YAML parsing), strings, and missing values
 */
export function normalizeDate(date: unknown): string {
  if (!date) return todayISO();
  if (date instanceof Date) return date.toISOString().split("T")[0];
  if (typeof date === "string") {
    // If already YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    // Try to parse and convert
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  }
  return todayISO();
}

/**
 * Generate preview text from markdown content
 * Used for notes and meetings to show a snippet in lists
 */
export function generatePreview(content: string, maxLength: number = 100): string {
  return content.slice(0, maxLength).replace(/[#\n]/g, " ").trim() + "...";
}
