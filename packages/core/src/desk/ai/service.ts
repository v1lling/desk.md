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
  model?: string;
  onUsage?: (usage: AIUsage) => void;
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

  /**
   * Custom purpose with your own system prompt.
   * Used by context index builder for batch summarization.
   */
  async custom(
    systemPrompt: string,
    message: string,
  ): Promise<AIServiceResponse> {
    const providerDef = getProviderDefinition(this.config.providerType);
    // Key comes from the injectable host seam (Keychain on the app, env on the server).
    const resolvedKey = (await getAIKeyResolver()(providerDef.keyRef)) ?? undefined;
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
      this.config.onUsage(response.usage);
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
