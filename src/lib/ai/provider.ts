import type { AIProvider, AIProviderType } from './types';
import { createAnthropicProvider } from './providers/anthropic';
import { createOpenAIProvider } from './providers/openai';

export interface ProviderConfig {
  type: AIProviderType;
  apiKey?: string; // Required for API providers
  model?: string;  // Model ID (provider-specific)
}

/**
 * Create an AI provider based on the configuration.
 *
 * - 'anthropic': Uses Anthropic API directly (requires API key)
 * - 'openai': Uses OpenAI API directly (requires API key)
 */
export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.type) {
    case 'anthropic':
      if (!config.apiKey) {
        throw new Error('Anthropic API requires an API key');
      }
      return createAnthropicProvider(config.apiKey, config.model);

    case 'openai':
      if (!config.apiKey) {
        throw new Error('OpenAI API requires an API key');
      }
      return createOpenAIProvider(config.apiKey, config.model);

    default:
      throw new Error(`Unknown provider: ${config.type}`);
  }
}

/**
 * Get the default provider type based on environment.
 * Defaults to OpenAI.
 */
export function getDefaultProviderType(): AIProviderType {
  return 'openai';
}
