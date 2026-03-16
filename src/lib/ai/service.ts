import { createProvider } from './provider';
import { buildPrompt } from './prompts';
import { getProviderDefinition } from './provider-registry';
import { getSecret } from './secrets';
import type {
  AIPurpose,
  AIServiceRequest,
  AIServiceResponse,
  AIUsage,
  AIProviderType,
} from './types';

// =============================================================================
// AI Service - Purpose-based API
// =============================================================================

export interface AIServiceConfig {
  providerType: AIProviderType;
  apiKey?: string;
  model?: string;
  onUsage?: (usage: AIUsage, purpose: AIPurpose, provider: AIProviderType) => void;
}

/**
 * AI Service provides a high-level, purpose-based API for AI interactions.
 * It handles prompt building, context injection, and usage tracking.
 */
export class AIService {
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = config;
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Generic request handler for all purposes
   */
  async request(req: AIServiceRequest): Promise<AIServiceResponse> {
    const providerDef = getProviderDefinition(this.config.providerType);
    const resolvedKey = this.config.apiKey ?? await getSecret(providerDef.keyRef) ?? undefined;

    const provider = createProvider({
      type: this.config.providerType,
      apiKey: resolvedKey,
      model: this.config.model,
    });

    // Build the prompt for this purpose
    const { systemPrompt } = buildPrompt(
      req.purpose,
      req.message,
      req.context,
      req.customSystemPrompt,
      req.userInstructions
    );

    // Make the request
    const response = await provider.chat({
      message: req.message,
      systemPrompt,
      context: req.context,
      history: req.history,
    });

    // Track usage if callback provided
    if (response.usage && this.config.onUsage) {
      this.config.onUsage(response.usage, req.purpose, this.config.providerType);
    }

    return {
      message: response.message,
      usage: response.usage,
    };
  }

  /**
   * Custom purpose with your own system prompt.
   * Used by context catalog indexing/selection utilities.
   */
  async custom(
    systemPrompt: string,
    message: string,
    options?: {
      context?: AIServiceRequest['context'];
      history?: AIServiceRequest['history'];
    }
  ): Promise<AIServiceResponse> {
    return this.request({
      purpose: 'custom',
      message,
      context: options?.context,
      history: options?.history,
      customSystemPrompt: systemPrompt,
    });
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a new AI service instance
 */
export function createAIService(config: AIServiceConfig): AIService {
  return new AIService(config);
}
