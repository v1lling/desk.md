import { useAISettingsStore } from "@/stores/ai";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

/**
 * Check if AI provider is configured for Smart Index.
 * Claude Code CLI works without API key, Anthropic API requires key.
 */
export function isAIProviderConfigured(): boolean {
  const { providerType, anthropicApiKey } = useAISettingsStore.getState();

  if (providerType === "claude-code") {
    return true;
  }

  if (providerType === "anthropic-api") {
    return !!anthropicApiKey?.trim();
  }

  return false;
}
