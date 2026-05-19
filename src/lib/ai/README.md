# AI Module

Desk uses an API-key-first architecture with a provider registry.

## Providers

- `openai` via `@ai-sdk/openai`
- `anthropic` via `@ai-sdk/anthropic`

Provider metadata and model factories live in:

- `src/lib/ai/provider-registry.ts`

The runtime provider adapter selection lives in:

- `src/lib/ai/provider.ts`

## Secrets

API keys are stored in OS keychain through Tauri commands:

- `secret_get`
- `secret_set`
- `secret_delete`

TypeScript wrappers are in:

- `src/lib/ai/secrets.ts`

No AI API keys are persisted in Zustand/localStorage.

## Service layer

`AIService` handles raw AI calls for internal helpers (Smart Index summarization).
The in-app assistant uses its own orchestrator (`src/lib/assistant/orchestrator.ts`).

File:

- `src/lib/ai/service.ts`

## Assistant

The in-app chat assistant is a read-only advisor with 5 tools:
- `desk_workspace_info` — list workspaces and projects
- `desk_tree` — browse file tree
- `desk_catalog` — query Smart Index summaries
- `desk_read` — read file content
- `desk_search` — full-text search

Files:

- `src/lib/assistant/orchestrator.ts` — streaming turn runner
- `src/lib/assistant/tool-core.ts` — tool definitions
- `src/lib/assistant/types.ts` — event and message types

## Adding a provider

1. Add provider definition to `PROVIDER_REGISTRY` with:
- `providerId`
- `keyRef`
- `defaultModel`
- `models`
- `createModel`
2. Add provider-specific model list in `src/lib/ai/models.ts`.
3. Extend `AIProviderType` in `src/lib/ai/types.ts`.
4. Add adapter in `createProvider()` (`src/lib/ai/provider.ts`).
