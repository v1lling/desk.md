import { useAISettingsStore } from "@/stores/ai";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

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

/**
 * Check if AI provider is configured for Smart Index.
 * OpenAI and Anthropic both require API keys.
 */
export function isAIProviderConfigured(): boolean {
  const { providerType, providerConfigured } = useAISettingsStore.getState();
  return !!providerConfigured[providerType];
}
