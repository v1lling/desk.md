import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { AIProvider, AIRequest, AIResponse } from '../types';

/**
 * Creates an Anthropic API provider that uses the Anthropic API directly.
 * Requires an API key to be configured.
 *
 * Note: This is a "dumb" transport layer. The service layer handles
 * prompt building and context injection before calling this provider.
 */
export function createAnthropicProvider(apiKey: string, model?: string): AIProvider {
  const anthropic = createAnthropic({ apiKey });
  const modelId = model || 'claude-sonnet-4-5';

  return {
    id: 'anthropic',
    name: 'Anthropic',

    async chat(request: AIRequest): Promise<AIResponse> {
      try {
        const { text, usage } = await generateText({
          model: anthropic(modelId),
          system: request.systemPrompt, // Already built by service layer
          messages: [{ role: 'user', content: request.message }],
        });

        return {
          message: text,
          usage: usage?.inputTokens && usage?.outputTokens ? {
            promptTokens: usage.inputTokens,
            completionTokens: usage.outputTokens,
            totalTokens: usage.inputTokens + usage.outputTokens,
          } : undefined,
        };
      } catch (error) {
        throw new Error(`Anthropic API error: ${error}`);
      }
    },
  };
}
