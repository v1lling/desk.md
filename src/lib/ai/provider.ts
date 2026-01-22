import type { AIProvider, AIProviderType } from './types';
import { createClaudeCodeProvider } from './providers/claude-code';
import { createAnthropicProvider } from './providers/anthropic';

export interface ProviderConfig {
  type: AIProviderType;
  apiKey?: string; // Required for anthropic-api
}

/**
 * Create an AI provider based on the configuration.
 *
 * - 'claude-code': Uses Claude Code CLI via Tauri (free, uses your Claude Code subscription)
 * - 'anthropic-api': Uses Anthropic API directly (requires API key)
 */
export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.type) {
    case 'claude-code':
      return createClaudeCodeProvider();

    case 'anthropic-api':
      if (!config.apiKey) {
        throw new Error('Anthropic API requires an API key');
      }
      return createAnthropicProvider(config.apiKey);

    default:
      throw new Error(`Unknown provider: ${config.type}`);
  }
}

/**
 * Get the default provider type based on environment.
 * Prefers Claude Code in Tauri, falls back to mock in browser.
 */
export function getDefaultProviderType(): AIProviderType {
  return 'claude-code';
}
