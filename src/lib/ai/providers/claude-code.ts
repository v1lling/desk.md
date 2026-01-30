import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/desk/tauri-fs';
import type { AIProvider, AIRequest, AIResponse } from '../types';

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
 * Note: This is a "dumb" transport layer. The service layer handles
 * prompt building and context injection before calling this provider.
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

      // Build prompt with conversation history
      let prompt = '';
      if (request.history && request.history.length > 0) {
        prompt = request.history
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');
        prompt += `\n\nUser: ${request.message}`;
      } else {
        prompt = request.message;
      }

      try {
        const response = await invoke<TauriChatResponse>('claude_chat', {
          request: {
            prompt,
            system_prompt: request.systemPrompt, // Already built by service layer
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
 * Detailed status of Claude Code CLI
 */
export interface ClaudeCodeStatus {
  available: boolean;
  path?: string;
  error?: string;
}

/**
 * Check if Claude Code CLI is available with detailed status
 */
export async function checkClaudeCode(): Promise<ClaudeCodeStatus> {
  if (!isTauri()) {
    return {
      available: false,
      error: 'Claude Code requires the desktop app (not available in browser)',
    };
  }

  try {
    return await invoke<ClaudeCodeStatus>('claude_check');
  } catch (e) {
    return {
      available: false,
      error: `Failed to check: ${e}`,
    };
  }
}

/**
 * Check if Claude Code CLI is available (simple boolean)
 */
export async function isClaudeCodeAvailable(): Promise<boolean> {
  const status = await checkClaudeCode();
  return status.available;
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
