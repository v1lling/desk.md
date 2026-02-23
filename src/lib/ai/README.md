# AI Module Architecture

This module provides a layered, extensible AI integration for Desk.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  UI Components                                               │
│  (AIChatPanel, future: EmailDraftButton, TaskFinder, etc.)  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Stores (src/stores/ai.ts)                                  │
│  - useAISettingsStore: Provider config, API keys            │
│  - useAIUsageStore: Token tracking, usage history           │
│  - useAIChatStore: Chat messages, conversation state         │
│  Hooks:                                                     │
│  - useSendMessage(): Chat with history (for chat panel)     │
│  - useAIAction(): One-off actions (draftEmail, summarize)   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Service Layer (src/lib/ai/service.ts)                      │
│  AIService class - Purpose-based API:                       │
│  - chat(message, options)                                   │
│  - draftEmail(email, instructions)                          │
│  - summarize(content, options)                              │
│  - findTasks(content) → returns structured tasks            │
│  - explain(content, question)                               │
│  - custom(systemPrompt, message)                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Prompts (src/lib/ai/prompts.ts)                            │
│  - System prompts per purpose                               │
│  - Context formatting (docs, tasks, emails → text)          │
│  - buildPrompt(purpose, message, context)                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Provider Layer (src/lib/ai/provider.ts)                    │
│  createProvider(config) → AIProvider                        │
└─────────────┬───────────────────────────────┬───────────────┘
              │                               │
┌─────────────▼─────────────┐   ┌─────────────▼─────────────┐
│  Claude Code Provider     │   │  Anthropic API Provider   │
│  (providers/claude-code)  │   │  (providers/anthropic)    │
│  - Uses Tauri invoke      │   │  - Uses AI SDK            │
│  - Spawns CLI             │   │  - Direct HTTP            │
│  - Token tracking (JSON)  │   │  - Token tracking         │
└───────────────────────────┘   └───────────────────────────┘
```

## Adding a New Provider

1. Create `src/lib/ai/providers/your-provider.ts`:

```typescript
import type { AIProvider, AIRequest, AIResponse } from '../types';

/**
 * Note: Providers are "dumb" transport layers. The service layer handles
 * prompt building and passes systemPrompt via the request object.
 */
export function createYourProvider(config: YourConfig): AIProvider {
  return {
    id: 'your-provider',
    name: 'Your Provider',

    async chat(request: AIRequest): Promise<AIResponse> {
      // request.systemPrompt is already built by the service layer
      const response = await yourApiCall({
        system: request.systemPrompt,
        message: request.message,
        history: request.history,
      });

      return {
        message: response.text,
        usage: {
          promptTokens: response.inputTokens,
          completionTokens: response.outputTokens,
          totalTokens: response.inputTokens + response.outputTokens,
        },
      };
    },
  };
}
```

2. Add to `src/lib/ai/provider.ts`:

```typescript
import { createYourProvider } from './providers/your-provider';

export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.type) {
    // ...existing cases
    case 'your-provider':
      return createYourProvider(config.yourConfig);
  }
}
```

3. Add type to `src/lib/ai/types.ts`:

```typescript
export type AIProviderType = 'claude-code' | 'anthropic-api' | 'your-provider';
```

## Adding a New Purpose

1. Add purpose type in `src/lib/ai/types.ts`:

```typescript
export type AIPurpose =
  | 'chat'
  | 'draft-email'
  // ...
  | 'your-purpose';
```

2. Add system prompt in `src/lib/ai/prompts.ts`:

```typescript
const SYSTEM_PROMPTS = {
  // ...
  'your-purpose': `You are a ... assistant. Do X, Y, Z.`,
};
```

3. Add convenience method in `src/lib/ai/service.ts`:

```typescript
async yourPurpose(input: string, options?: {...}): Promise<AIServiceResponse> {
  return this.request({
    purpose: 'your-purpose',
    message: input,
    context: options?.context,
  });
}
```

## Usage Examples

### Chat Panel (with conversation history)
```typescript
// useSendMessage manages chat history in useAIChatStore
// Context is automatically retrieved via the selected strategy (Smart Index / RAG / None)
const sendMessage = useSendMessage();
sendMessage.mutate({
  message: "What is this about?",
  history: previousMessages,
});
```

### Draft Email (one-off action)
```typescript
const { draftEmail } = useAIAction();
const response = await draftEmail(
  { from: 'client@example.com', subject: 'Question', body: '...' },
  'Reply politely declining the meeting'
);
```

### Find Tasks (one-off action)
```typescript
const { findTasks } = useAIAction();
const response = await findTasks(meetingNotes);
console.log(response.structured?.tasks); // [{ id, title, status }]
```

## Token Tracking

Usage is tracked automatically for both providers:

```typescript
const { getStats } = useAIUsageStore();
const stats = getStats();
// { totalTokens: 1234, totalRequests: 10, byProvider: {...} }
```

Both providers now return token usage:
- **Claude Code CLI**: Uses `--output-format json` to get usage data
- **Anthropic API**: Returns usage from AI SDK

The response also includes `cost_usd` from Claude Code CLI.
