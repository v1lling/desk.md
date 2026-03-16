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

`AIService` handles prompt construction and raw purpose-based calls for internal helpers.
Current app usage is focused on `request()` and `custom()` for context-catalog flows.

File:

- `src/lib/ai/service.ts`

## MCP path

- Advanced tool workflows run through the standalone `desk-mcp` sidecar.
- In-app AI runs through the Assistant orchestrator/tool loop (including email drafting handoff).

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
