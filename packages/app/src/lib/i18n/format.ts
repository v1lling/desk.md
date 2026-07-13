import i18next from "i18next";
import { format, parseISO } from "date-fns";

const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
};

function currentLocale(): string {
  return LOCALE_MAP[i18next.language] ?? i18next.language ?? "en-US";
}

/**
 * Parse a `YYYY-MM-DD` date-only string as **local** midnight. `new Date("2026-01-15")`
 * parses as UTC midnight, which renders as the previous day in negative-offset zones — so
 * a date-only value must be constructed from its local parts. Full ISO timestamps (with a
 * time/zone) are left to the native parser.
 */
function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(value);
}

export function formatLocaleDate(
  value: string | Date,
  opts: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) {
    return typeof value === "string" ? value : "";
  }
  return new Intl.DateTimeFormat(currentLocale(), opts).format(d);
}

/**
 * Format an optional ISO date with a date-fns pattern, yielding "" for a missing
 * or unparseable value. For the short inline dates in list rows ("MMM d").
 */
export function safeFormat(iso: string | undefined, pattern: string): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return "";
  }
}

/**
 * Relative time from now ("2 hours ago", "yesterday"), locale-aware via
 * Intl.RelativeTimeFormat. Accepts date-only strings (local midnight) and full
 * ISO timestamps. Falls back to a short absolute date beyond ~4 weeks.
 */
export function formatRelativeTime(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) {
    return typeof value === "string" ? value : "";
  }
  const diffSeconds = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(currentLocale(), { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diffSeconds), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSeconds / 3600), "hour");
  if (abs < 86400 * 28) return rtf.format(Math.round(diffSeconds / 86400), "day");
  return formatLocaleDate(d, { day: "numeric", month: "short" });
}
