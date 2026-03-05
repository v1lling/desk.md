import { format, parseISO } from "date-fns";

/**
 * Format an ISO date string for display (e.g., "20 Jan 2024")
 */
export function formatDate(iso: string): string {
  return format(parseISO(iso), "d MMM yyyy");
}

/**
 * Strip common markdown syntax for plain-text previews.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")       // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")    // bold
    .replace(/__(.+?)__/g, "$1")        // bold alt
    .replace(/\*(.+?)\*/g, "$1")        // italic
    .replace(/_(.+?)_/g, "$1")          // italic alt
    .replace(/~~(.+?)~~/g, "$1")        // strikethrough
    .replace(/`(.+?)`/g, "$1")          // inline code
    .replace(/^- \[[ x]\]\s*/gm, "")    // task list items
    .replace(/^[-*+]\s+/gm, "")         // unordered list items
    .replace(/^\d+\.\s+/gm, "")         // ordered list items
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // images
    .replace(/^>\s+/gm, "")             // blockquotes
    .replace(/\n{2,}/g, " ")            // collapse multiple newlines
    .replace(/\n/g, " ")                // remaining newlines to spaces
    .trim();
}
