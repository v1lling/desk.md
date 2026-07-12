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
    content: body,
  };
}

// Reserved gray-matter keys that should not be in frontmatter data
const GRAY_MATTER_RESERVED = ["engine", "engines", "language", "delimiters", "excerpt"];

/**
 * Replace the `null` "clear" sentinel with `undefined` in an updates object.
 * Used by mock-mode update paths that spread updates straight into in-memory state,
 * so a cleared field reads as absent (undefined) instead of a literal null.
 */
export function clearNulls<T extends Record<string, unknown>>(
  updates: T
): { [K in keyof T]: Exclude<T[K], null> } {
  const out: Record<string, unknown> = { ...updates };
  for (const k in out) if (out[k] === null) out[k] = undefined;
  return out as { [K in keyof T]: Exclude<T[K], null> };
}

/**
 * Serialize data and content back to markdown with frontmatter
 * Automatically removes undefined values and gray-matter reserved keys
 */
export function serializeMarkdown(data: unknown, content: string): string {
  // Guard against non-object data - Object.entries() on a string produces { '0': 'c', '1': 'h', ... }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(
      `[parser] serializeMarkdown received invalid data type: ${typeof data}${Array.isArray(data) ? " (array)" : ""}`
    );
  }

  // Filter out undefined values and gray-matter reserved keys
  const cleanedData = Object.fromEntries(
    Object.entries(data as Record<string, unknown>).filter(
      ([key, value]) =>
        value !== undefined && !GRAY_MATTER_RESERVED.includes(key)
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
 * Format a Date as a `YYYY-MM-DD` string using the **local** calendar day.
 * The single source of truth for "what day is it here" — never use
 * `toISOString()` for a date-only value: that yields the UTC day, which is a
 * day behind for positive-offset zones just after midnight (and ahead for
 * negative-offset zones just before midnight).
 */
export function formatLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Generate a filename for a task/doc: YYYY-MM-DD-slug.md
 */
export function generateFilename(title: string, date?: Date): string {
  const dateStr = formatLocalISODate(date || new Date());
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
  return formatLocalISODate(new Date());
}

/**
 * Normalize a date value to YYYY-MM-DD string format
 * Handles Date objects (from gray-matter YAML parsing), strings, and missing values
 */
export function normalizeDate(date: unknown): string {
  if (!date) return todayISO();
  // A Date here comes from YAML (`created: 2026-05-17`), which parses bare dates as UTC
  // midnight — so the UTC calendar day IS the day that was written. formatLocalISODate
  // would shift it back a day in negative-offset zones; toISOString is correct here.
  if (date instanceof Date) return date.toISOString().split("T")[0];
  if (typeof date === "string") {
    // If already YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    // Non-ISO strings ("May 17, 2026", "2026/05/17") parse as LOCAL time, so take the
    // local day — toISOString would yield the previous UTC day in positive-offset zones.
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) return formatLocalISODate(parsed);
  }
  return todayISO();
}

/**
 * Extract a leading YYYY-MM-DD date from a filename (the prefix `generateFilename` writes),
 * e.g. "2026-05-17-konzept.md" → "2026-05-17". Accepts a bare name or a full path. Returns
 * undefined when there's no valid date prefix.
 */
export function extractDateFromFilename(fileNameOrPath: string): string | undefined {
  const name = fileNameOrPath.split(/[\\/]/).pop() ?? fileNameOrPath;
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})-/);
  if (!m) return undefined;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  // Reject impossible dates (e.g. 2026-13-40, 2026-02-30 rolling over).
  const d = new Date(`${iso}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : undefined;
}

/**
 * Resolve a content date with a sensible fallback chain:
 *   frontmatter value → filename date prefix → today.
 * Use for `created` (and meeting `date`) so files lacking a frontmatter date don't all
 * collapse to the scan date.
 */
export function resolveContentDate(frontmatterValue: unknown, fileNameOrPath: string): string {
  if (frontmatterValue) return normalizeDate(frontmatterValue);
  return extractDateFromFilename(fileNameOrPath) ?? todayISO();
}

/**
 * Generate preview text from markdown content
 * Used for notes and meetings to show a snippet in lists
 */
export function generatePreview(content: string, maxLength: number = 100): string {
  return content.slice(0, maxLength).replace(/[#\n]/g, " ").trim() + "...";
}
