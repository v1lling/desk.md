import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/orbit/tauri-fs';
import type { AIProvider, AIRequest, AIResponse } from '../types';
import { buildPrompt } from '../prompts';

interface TauriChatRequest {
  prompt: string;
  system_prompt?: string;
}

interface TauriTokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface TauriChatResponse {
  message: string;
  usage?: TauriTokenUsage;
  cost_usd?: number;
}

/**
 * Creates a Claude Code provider that uses the Claude Code CLI via Tauri.
 * Falls back to mock responses in browser mode.
 *
 * Token usage IS available via --output-format json.
 */
export function createClaudeCodeProvider(): AIProvider {
  return {
    id: 'claude-code',
    name: 'Claude Code',

    async chat(request: AIRequest): Promise<AIResponse> {
      // In browser mode, return mock responses
      if (!isTauri()) {
        return mockResponse(request);
      }

      // Build prompt with context
      const { systemPrompt, userMessage } = buildPrompt(
        'chat',
        request.message,
        request.context,
        request.systemPrompt
      );

      // Use provided system prompt if available, otherwise use built one
      const finalSystemPrompt = request.systemPrompt || systemPrompt;

      // Build prompt with conversation history
      let prompt = '';
      if (request.history && request.history.length > 0) {
        prompt = request.history
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');
        prompt += `\n\nUser: ${userMessage}`;
      } else {
        prompt = userMessage;
      }

      try {
        const response = await invoke<TauriChatResponse>('claude_chat', {
          request: {
            prompt,
            system_prompt: finalSystemPrompt,
          } as TauriChatRequest,
        });

        return {
          message: response.message,
          usage: response.usage ? {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.total_tokens,
          } : undefined,
        };
      } catch (error) {
        throw new Error(`Claude Code error: ${error}`);
      }
    },
  };
}

/**
 * Check if Claude Code CLI is available
 */
export async function isClaudeCodeAvailable(): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }

  try {
    return await invoke<boolean>('claude_check');
  } catch {
    return false;
  }
}

/**
 * Mock response for browser development mode
 */
function mockResponse(request: AIRequest): Promise<AIResponse> {
  const contextInfo = request.context?.docs?.length
    ? `\n\n(Using ${request.context.docs.length} doc(s) as context: ${request.context.docs.map((d) => d.title).join(', ')})`
    : '';

  return Promise.resolve({
    message: `[Mock Response] You said: "${request.message}"${contextInfo}\n\nThis is a mock response because you're in browser mode. Run \`npm run tauri dev\` to use Claude Code CLI.`,
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
  });
}
