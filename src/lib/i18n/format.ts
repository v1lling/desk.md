import i18next from "i18next";

const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
};

function currentLocale(): string {
  return LOCALE_MAP[i18next.language] ?? i18next.language ?? "en-US";
}

export function formatLocaleDate(
  value: string | Date,
  opts: Intl.DateTimeFormatOptions,
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return typeof value === "string" ? value : "";
  }
  return new Intl.DateTimeFormat(currentLocale(), opts).format(d);
}
