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
