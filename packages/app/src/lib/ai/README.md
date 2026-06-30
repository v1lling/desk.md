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

API keys are stored in the OS keychain (Keychain on macOS, Credential Manager
on Windows, Secret Service / GNOME Keyring / KWallet on Linux) through Tauri
commands:

- `secret_get`
- `secret_set`
- `secret_delete`

TypeScript wrappers are in:

- `src/lib/ai/secrets.ts`

No AI API keys are persisted in Zustand/localStorage. Browser mode
(`npm run dev`) has no keychain access, so `getSecret`/`setSecret`/`deleteSecret`
throw `BrowserModeError` there — AI features are off until you run
`npm run tauri:dev` or the built app. Real keychain failures (locked, service
unavailable) throw a plain `Error` with the underlying message; callers should
distinguish the two via `error instanceof BrowserModeError`.

## Service layer

`AIService` is the only consumer of this module: it makes the raw AI calls for the
**Smart Index** summarizer (`src/lib/context-index/builder.ts` for batch builds,
`indexer.ts` for on-save refreshes). `AIService.custom(systemPrompt, message)` runs a
single non-streaming completion and reports token usage via the optional `onUsage`
callback — the builder/indexer use it to log usage (`purpose: 'index'`) to the AI settings
Usage panel.

There is no in-app chat assistant. External agents read/write desk over **MCP**
(`@desk/server`, see `packages/server/src/mcp.ts`) or the generated `CLAUDE.md`/`AGENTS.md`.

File:

- `src/lib/ai/service.ts`

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
