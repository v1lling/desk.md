import i18next from "i18next";

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
