# AI Module Architecture

This module provides a layered, extensible AI integration for Orbit.

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
│  - useAIChatStore: Chat messages, selected docs             │
│  - useAIService(): Get configured service instance          │
│  - useSendMessage(): Chat mutation hook                     │
│  - useAIAction(): Quick actions (draftEmail, summarize...)  │
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
│  - No token tracking      │   │  - Full token tracking    │
└───────────────────────────┘   └───────────────────────────┘
```

## Adding a New Provider

1. Create `src/lib/ai/providers/your-provider.ts`:

```typescript
import type { AIProvider, AIRequest, AIResponse } from '../types';
import { buildPrompt } from '../prompts';

export function createYourProvider(config: YourConfig): AIProvider {
  return {
    id: 'your-provider',
    name: 'Your Provider',

    async chat(request: AIRequest): Promise<AIResponse> {
      const { systemPrompt } = buildPrompt('chat', request.message, request.context);

      // Your API call here
      const response = await yourApiCall({...});

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

### Basic Chat
```typescript
const service = useAIService();
const response = await service.chat("What is this about?", {
  context: { docs: [{ id: '1', title: 'Doc', content: '...' }] }
});
```

### Draft Email
```typescript
const { draftEmail } = useAIAction();
const response = await draftEmail(
  { from: 'client@example.com', subject: 'Question', body: '...' },
  'Reply politely declining the meeting'
);
```

### Find Tasks (with structured output)
```typescript
const { findTasks } = useAIAction();
const response = await findTasks(meetingNotes);
console.log(response.structured?.tasks); // [{ id, title, status }]
```

### Custom Purpose
```typescript
const service = useAIService();
const response = await service.custom(
  'You are a code reviewer. Find bugs and suggest improvements.',
  codeToReview
);
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
