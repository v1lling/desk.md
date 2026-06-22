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

`AIService` handles raw AI calls for internal helpers (Smart Index summarization).
The in-app assistant uses its own orchestrator (`src/lib/assistant/orchestrator.ts`).

File:

- `src/lib/ai/service.ts`

## Assistant

The in-app chat assistant can read and write workspace data.

Read tools:
- `desk_workspace_info` — list workspaces and projects
- `desk_tree` — browse file tree
- `desk_catalog` — query Smart Index summaries
- `desk_read` — read file content
- `desk_search` — full-text search

Write tools:
- `desk_create_task` / `desk_update_task`
- `desk_create_doc` / `desk_update_doc`
- `desk_create_meeting` / `desk_update_meeting`

All tools run on the `@desk/core` domain layer via the `StorageProvider` seam —
read queries live in `@desk/core` (`agent-queries.ts`), writes reuse the same
CRUD functions the UI calls. There are no Rust `desk_*` commands.

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
