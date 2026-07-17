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
 * Current instant as a full ISO datetime (UTC, e.g. "2026-07-09T14:03:21.000Z").
 * Used for the `updated` frontmatter stamp. UTC because `Date.toISOString()`
 * round-trips exactly through YAML (js-yaml parses the unquoted timestamp back
 * to the same instant) and sorts lexicographically without offset ambiguity.
 * Never route this value through `normalizeDate` — that truncates to a day.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Normalize an `updated` frontmatter value to a full ISO datetime string, or
 * undefined when absent/unparseable. YAML parses an unquoted timestamp as a Date
 * object; keep full precision (unlike `normalizeDate`, which truncates to
 * YYYY-MM-DD). Unparseable strings are rejected rather than passed through — they
 * would otherwise sort as garbage and render verbatim in relative-time labels.
 */
export function normalizeDateTime(value: unknown): string | undefined {
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value.toISOString();
  if (typeof value === "string" && value && !isNaN(Date.parse(value))) return value;
  return undefined;
}

/**
 * Normalize a date value to YYYY-MM-DD, or undefined when absent/unparseable.
 * "No date" is representable — never fabricate today here.
 */
export function normalizeOptionalDate(date: unknown): string | undefined {
  if (!date) return undefined;
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
  return undefined;
}

/**
 * Normalize a date value to YYYY-MM-DD, falling back to today when absent/unparseable.
 * Only for fields that must always carry a date (workspace/project `created`, task `due`);
 * content dates go through `resolveContentDate`, which keeps "no date" representable.
 */
export function normalizeDate(date: unknown): string {
  return normalizeOptionalDate(date) ?? todayISO();
}

/**
 * Extract a leading YYYY-MM-DD date from a filename (the prefix `generateFilename` writes),
 * e.g. "2026-05-17-konzept.md" → "2026-05-17". Accepts a bare name or a full path. Returns
 * undefined when there's no valid date prefix.
 */
function extractDateFromFilename(fileNameOrPath: string): string | undefined {
  const name = fileNameOrPath.split(/[\\/]/).pop() ?? fileNameOrPath;
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})-/);
  if (!m) return undefined;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  // Reject impossible dates (e.g. 2026-13-40, 2026-02-30 rolling over).
  const d = new Date(`${iso}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : undefined;
}

/**
 * Resolve a content date: frontmatter value → filename date prefix → undefined.
 * Use for `created` (and meeting `date`). "No date" is representable — a file dropped
 * into the tree without frontmatter or a date-prefixed name must NOT masquerade as
 * created today (it would float to the top of every newest-first list on every scan).
 * Undated items sort last and display nothing.
 */
export function resolveContentDate(
  frontmatterValue: unknown,
  fileNameOrPath: string
): string | undefined {
  return normalizeOptionalDate(frontmatterValue) ?? extractDateFromFilename(fileNameOrPath);
}

/**
 * Descending compare for optional YYYY-MM-DD / ISO datetime strings (lexicographic,
 * which is chronological for this format). Undated values sort LAST.
 */
export function compareDatesDesc(a?: string, b?: string): number {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return b.localeCompare(a);
}

/**
 * Generate preview text from markdown content
 * Used for notes and meetings to show a snippet in lists
 */
export function generatePreview(content: string, maxLength: number = 100): string {
  return content.slice(0, maxLength).replace(/[#\n]/g, " ").trim() + "...";
}
