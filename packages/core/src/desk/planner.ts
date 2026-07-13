/**
 * Planner utilities — date helpers for week planning
 */

import { startOfWeek, addDays, format, parseISO } from "date-fns";

/**
 * Get the ISO date string of Monday for the week containing the given date
 */
export function getWeekMonday(date: Date): string {
  const monday = startOfWeek(date, { weekStartsOn: 1 }); // Monday = 1
  return format(monday, "yyyy-MM-dd");
}

/**
 * Get an array of ISO date strings for a week starting from the given Monday
 * @param monday - ISO date of Monday (e.g. "2026-03-23")
 * @param includeWeekends - Whether to include Saturday and Sunday
 */
export function getWeekDays(monday: string, includeWeekends: boolean): string[] {
  const start = parseISO(monday);
  const count = includeWeekends ? 7 : 5;
  return Array.from({ length: count }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
}

/**
 * Format a day name from an ISO date (e.g. "Mon", "Tue")
 */
export function formatDayName(isoDate: string): string {
  return format(parseISO(isoDate), "EEE");
}

/**
 * Format a day number from an ISO date (e.g. "24")
 */
export function formatDayNumber(isoDate: string): string {
  return format(parseISO(isoDate), "d");
}

/**
 * Format a week range label (e.g. "23 Mar – 27 Mar 2026")
 */
export function formatWeekRange(monday: string, includeWeekends: boolean): string {
  const start = parseISO(monday);
  const end = addDays(start, includeWeekends ? 6 : 4);
  const startStr = format(start, "d MMM");
  const endStr = format(end, "d MMM yyyy");
  return `${startStr} – ${endStr}`;
}

// ── Time-axis helpers ──────────────────────────────────────────────

/** Default height in pixels for each 30-minute slot */
export const SLOT_HEIGHT = 48;

/** Minimum slot height — below this, scrolling activates */
export const MIN_SLOT_HEIGHT = 20;

/** Convert minutes-from-midnight to display string (e.g. 540 → "9:00") */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

/** Snap minutes to nearest slot boundary */
export function snapToSlot(minutes: number, slotSize = 30): number {
  return Math.round(minutes / slotSize) * slotSize;
}

/** Check whether two time ranges overlap */
export function blocksOverlap(
  a: { startMinute: number; endMinute: number },
  b: { startMinute: number; endMinute: number }
): boolean {
  return a.startMinute < b.endMinute && a.endMinute > b.startMinute;
}

/** Find the largest contiguous gap between existing blocks within a range */
export function findLargestGap(
  blocks: { startMinute: number; endMinute: number }[],
  rangeStart: number,
  rangeEnd: number
): { start: number; end: number } {
  if (blocks.length === 0) return { start: rangeStart, end: rangeEnd };

  const sorted = [...blocks].sort((a, b) => a.startMinute - b.startMinute);
  let bestGap = { start: rangeStart, end: rangeStart };

  // Gap before first block
  if (sorted[0].startMinute > rangeStart) {
    const gap = { start: rangeStart, end: sorted[0].startMinute };
    if (gap.end - gap.start > bestGap.end - bestGap.start) bestGap = gap;
  }

  // Gaps between blocks
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = sorted[i].endMinute;
    const gapEnd = sorted[i + 1].startMinute;
    if (gapEnd - gapStart > bestGap.end - bestGap.start) {
      bestGap = { start: gapStart, end: gapEnd };
    }
  }

  // Gap after last block
  const last = sorted[sorted.length - 1];
  if (last.endMinute < rangeEnd) {
    const gap = { start: last.endMinute, end: rangeEnd };
    if (gap.end - gap.start > bestGap.end - bestGap.start) bestGap = gap;
  }

  return bestGap;
}

/** Compute the visible grid range based on blocks and work day */
export function computeGridRange(
  blocks: { startMinute: number; endMinute: number }[],
  workStartMinute: number,
  workEndMinute: number
): { startMinute: number; endMinute: number } {
  let earliest = workStartMinute;
  let latest = workEndMinute;

  for (const b of blocks) {
    if (b.startMinute < earliest) earliest = b.startMinute;
    if (b.endMinute > latest) latest = b.endMinute;
  }

  // Always show 6:00–23:00 at minimum so users can scroll to early/late hours.
  // Expand further if blocks exist outside that range.
  const startMinute = Math.floor(Math.min(earliest, 360) / 60) * 60; // 6:00 or earlier
  const endMinute = Math.ceil(Math.max(latest, 1380) / 60) * 60;     // 23:00 or later

  // Clamp to 0–24h
  return {
    startMinute: Math.max(0, startMinute),
    endMinute: Math.min(1440, endMinute),
  };
}

/** Convert minutes to pixel offset within the grid */
export function minuteToPixel(minute: number, gridStartMinute: number, slotHeight = SLOT_HEIGHT): number {
  return ((minute - gridStartMinute) / 30) * slotHeight;
}

/**
 * Convert a pixel *delta* to a minute delta. For dragging/resizing, where the
 * gesture moves an existing time by some distance.
 */
export function pixelsToMinutes(px: number, slotHeight = SLOT_HEIGHT): number {
  return (px / slotHeight) * 30;
}

/**
 * The snapped minute at a pixel offset from the top of the grid — the inverse of
 * `minuteToPixel`. Takes an offset, not a clientY, so this stays DOM-free.
 */
export function pixelToMinute(
  offsetY: number,
  gridStartMinute: number,
  slotHeight = SLOT_HEIGHT
): number {
  return snapToSlot(gridStartMinute + pixelsToMinutes(offsetY, slotHeight));
}
