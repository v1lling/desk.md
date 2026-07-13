import { format, parseISO } from "date-fns";
import { todayISO } from "@desk/core";

/**
 * Format an ISO date string for display (e.g., "20 Jan 2024")
 */
export function formatDate(iso: string): string {
  return format(parseISO(iso), "d MMM yyyy");
}

/**
 * Year-less date for tight spots (e.g., "20 Jan") — planner rows are ~20px tall and the
 * rail is 256px wide, where the full "20 Jan 2024" does not fit.
 */
export function formatDateShort(iso: string): string {
  return format(parseISO(iso), "d MMM");
}

/** Whether a `YYYY-MM-DD` date is the local today. String compare, same reasoning as isOverdue. */
export function isDueToday(due: string): boolean {
  return due === todayISO();
}

/**
 * Whether a `YYYY-MM-DD` due date is strictly before the local today.
 * Compares date strings lexicographically (which is chronological for this
 * format) instead of `new Date("YYYY-MM-DD")`, which parses as UTC midnight
 * and would flag a task due *today* as overdue in positive-offset zones.
 * Due today → not overdue.
 */
export function isOverdue(due: string): boolean {
  return due < todayISO();
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
