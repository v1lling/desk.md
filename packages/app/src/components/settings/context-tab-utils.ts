type TFunction = (key: string, options?: Record<string, unknown>) => string;

/**
 * Format a date string as a relative-time label. Requires a translator function
 * since the labels ("Never", "Just now", "{{count}} minutes ago", …) are
 * user-facing.
 */
export function formatRelativeTime(dateStr: string | null, t: TFunction): string {
  if (!dateStr) return t("settings.smartIndex.relativeTime.never");
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t("settings.smartIndex.relativeTime.justNow");
  if (minutes < 60) return t("settings.smartIndex.relativeTime.minutesAgo", { count: minutes });
  if (hours < 24) return t("settings.smartIndex.relativeTime.hoursAgo", { count: hours });
  return t("settings.smartIndex.relativeTime.daysAgo", { count: days });
}
