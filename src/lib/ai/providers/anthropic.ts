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
export function createAnthropicProvider(apiKey: string): AIProvider {
  const anthropic = createAnthropic({ apiKey });

  return {
    id: 'anthropic-api',
    name: 'Anthropic API',

    async chat(request: AIRequest): Promise<AIResponse> {
      // Build messages from history
      const messages = request.history?.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })) || [];

      // Add current message
      messages.push({ role: 'user', content: request.message });

      try {
        const { text, usage } = await generateText({
          model: anthropic('claude-sonnet-4-20250514'),
          system: request.systemPrompt, // Already built by service layer
          messages,
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
