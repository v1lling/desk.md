/**
 * RAG settings validation utilities
 *
 * Shared validation logic for embedding provider configuration.
 */

import type { EmbeddingSettings } from './types';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate that embedding settings are properly configured for a specific provider.
 * Returns validation result with error message if invalid.
 */
export function validateSettings(settings: EmbeddingSettings): ValidationResult {
  const provider = settings.provider;

  if (provider === "openai" && !settings.openaiApiKey?.trim()) {
    return {
      isValid: false,
      error: "OpenAI API key is required. Configure it in Settings -> RAG.",
    };
  }

  if (provider === "voyage" && !settings.voyageApiKey?.trim()) {
    return {
      isValid: false,
      error: "Voyage API key is required. Configure it in Settings -> RAG.",
    };
  }

  // For 'auto' mode, we allow proceeding - backend will try Ollama first
  // and fall back to cloud providers if available
  return { isValid: true };
}

/**
 * Check if a provider has the necessary configuration to attempt indexing.
 * For 'auto' mode, returns true if at least one provider could work.
 * This is a lighter check than validateSettings - it allows auto mode
 * to proceed even without API keys (Ollama might be available).
 */
export function hasProviderConfig(settings: EmbeddingSettings): boolean {
  const provider = settings.provider;

  switch (provider) {
    case "ollama":
      // Ollama just needs URL (we can't know if it's running without checking)
      return !!settings.ollamaUrl?.trim();
    case "openai":
      return !!settings.openaiApiKey?.trim();
    case "voyage":
      return !!settings.voyageApiKey?.trim();
    case "auto":
      // Auto mode can always try (Ollama might be available locally)
      return true;
    default:
      return false;
  }
}

/**
 * Get a human-readable description of what's missing for configuration.
 * Returns null if configuration is complete.
 */
export function getMissingConfigDescription(settings: EmbeddingSettings): string | null {
  const provider = settings.provider;

  switch (provider) {
    case "openai":
      if (!settings.openaiApiKey?.trim()) {
        return "OpenAI API key not configured";
      }
      break;
    case "voyage":
      if (!settings.voyageApiKey?.trim()) {
        return "Voyage API key not configured";
      }
      break;
    case "auto":
      // Auto mode: warn if no cloud fallback configured
      if (!settings.openaiApiKey?.trim() && !settings.voyageApiKey?.trim()) {
        return "No cloud API keys configured (will only work if Ollama is running)";
      }
      break;
  }

  return null;
}
