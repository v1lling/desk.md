import { runChat } from './transport';
import { getProviderDefinition } from './provider-registry';
import { getAIKeyResolver } from './key-resolver';
import { AIProviderError } from './errors';
import { BASE_CONTEXT } from './prompts';
import { todayISO } from '../parser';
import type {
  AIUsage,
  AIProviderType,
} from './types';

// =============================================================================
// AI Service - Used by Smart Index for batch summarization
// =============================================================================

export interface AIServiceConfig {
  providerType: AIProviderType;
  apiKey?: string;
  model?: string;
  onUsage?: (usage: AIUsage, purpose: string, provider: AIProviderType) => void;
}

export interface AIServiceResponse {
  message: string;
  usage?: AIUsage;
}

/**
 * AI Service for programmatic AI calls (Smart Index summarization).
 * The only consumer is the context-index builder/indexer.
 */
export class AIService {
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Custom purpose with your own system prompt.
   * Used by context index builder for batch summarization.
   */
  async custom(
    systemPrompt: string,
    message: string,
  ): Promise<AIServiceResponse> {
    const providerDef = getProviderDefinition(this.config.providerType);
    // Key comes from the injectable host seam (Keychain on the app, env on the server)
    // unless the caller supplies one explicitly.
    const resolvedKey =
      this.config.apiKey ?? (await getAIKeyResolver()(providerDef.keyRef)) ?? undefined;
    if (!resolvedKey) {
      throw new AIProviderError(
        "auth",
        this.config.providerType,
        `No ${providerDef.label} API key configured.`,
      );
    }

    const today = todayISO();
    const fullPrompt = `Today's date: ${today}.\n\n${BASE_CONTEXT}\n\n${systemPrompt}`;

    const response = await runChat({
      provider: this.config.providerType,
      apiKey: resolvedKey,
      model: this.config.model,
      systemPrompt: fullPrompt,
      message,
    });

    if (response.usage && this.config.onUsage) {
      this.config.onUsage(response.usage, 'custom', this.config.providerType);
    }

    return {
      message: response.message,
      usage: response.usage,
    };
  }
}

/**
 * Create a new AI service instance
 */
export function createAIService(config: AIServiceConfig): AIService {
  return new AIService(config);
}
