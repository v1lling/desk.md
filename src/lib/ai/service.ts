import { createProvider } from './provider';
import { buildPrompt } from './prompts';
import type {
  AIPurpose,
  AIContext,
  AIMessage,
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
    const provider = createProvider({
      type: this.config.providerType,
      apiKey: this.config.apiKey,
    });

    // Build the prompt for this purpose
    const { systemPrompt } = buildPrompt(
      req.purpose,
      req.message,
      req.context,
      req.customSystemPrompt
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

  // ===========================================================================
  // Convenience Methods for Common Purposes
  // ===========================================================================

  /**
   * General chat with optional context
   */
  async chat(
    message: string,
    options?: {
      context?: AIContext;
      history?: AIMessage[];
    }
  ): Promise<AIServiceResponse> {
    return this.request({
      purpose: 'chat',
      message,
      context: options?.context,
      history: options?.history,
    });
  }

  /**
   * Draft an email response
   */
  async draftEmail(
    originalEmail: { from: string; subject: string; body: string },
    instructions: string,
    options?: { context?: AIContext }
  ): Promise<AIServiceResponse> {
    return this.request({
      purpose: 'draft-email',
      message: instructions,
      context: {
        ...options?.context,
        emails: [{ id: 'original', ...originalEmail }],
      },
    });
  }

  /**
   * Summarize content
   */
  async summarize(
    content: string,
    options?: { maxLength?: 'short' | 'medium' | 'long' }
  ): Promise<AIServiceResponse> {
    const lengthInstruction = {
      short: 'Keep the summary to 1-2 sentences.',
      medium: 'Keep the summary to 3-5 sentences.',
      long: 'Provide a detailed summary with key points.',
    }[options?.maxLength || 'medium'];

    return this.request({
      purpose: 'summarize',
      message: `${lengthInstruction}\n\nContent to summarize:\n${content}`,
    });
  }

  /**
   * Find/extract tasks from content
   */
  async findTasks(
    content: string,
    options?: { context?: AIContext }
  ): Promise<AIServiceResponse> {
    const response = await this.request({
      purpose: 'find-tasks',
      message: `Extract actionable tasks from this content:\n\n${content}`,
      context: options?.context,
    });

    // Parse tasks from response (simple format: "- [ ] task")
    const taskRegex = /^- \[ \] (.+)$/gm;
    const tasks: { id: string; title: string; status: string }[] = [];
    let match;
    while ((match = taskRegex.exec(response.message)) !== null) {
      tasks.push({
        id: crypto.randomUUID(),
        title: match[1],
        status: 'todo',
      });
    }

    return {
      ...response,
      structured: { tasks },
    };
  }

  /**
   * Explain a concept or code
   */
  async explain(
    content: string,
    question?: string
  ): Promise<AIServiceResponse> {
    const message = question
      ? `${question}\n\nContent:\n${content}`
      : `Explain this:\n\n${content}`;

    return this.request({
      purpose: 'explain',
      message,
    });
  }

  /**
   * Custom purpose with your own system prompt
   */
  async custom(
    systemPrompt: string,
    message: string,
    options?: {
      context?: AIContext;
      history?: AIMessage[];
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
