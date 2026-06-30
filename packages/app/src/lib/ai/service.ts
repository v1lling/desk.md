import { createProvider } from './provider';
import { getProviderDefinition } from './provider-registry';
import { getSecret } from './secrets';
import { BASE_CONTEXT } from './prompts';
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
    const resolvedKey = this.config.apiKey ?? await getSecret(providerDef.keyRef) ?? undefined;

    const provider = createProvider({
      type: this.config.providerType,
      apiKey: resolvedKey,
      model: this.config.model,
    });

    const today = new Date().toISOString().split('T')[0];
    const fullPrompt = `Today's date: ${today}.\n\n${BASE_CONTEXT}\n\n${systemPrompt}`;

    const response = await provider.chat({
      message,
      systemPrompt: fullPrompt,
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
