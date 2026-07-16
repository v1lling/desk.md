# lib/ai — Keychain secrets only

The runtime-agnostic AI layer (types, prompts, providers, `AIService`, key-resolver seam)
lives in `@desk/core` (`packages/core/src/desk/ai/`) so it runs on whichever host owns the
data — this app in local mode, `@desk/server` in hosted mode ("AI maintenance runs where the
data lives").

What remains here is the ONE host-coupled piece: `secrets.ts`, OS-Keychain access via the
Tauri `secret_*` commands. `main.tsx` wires it into core's `setAIKeyResolver` seam; the
server wires env vars instead (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`, see `server/boot.ts`).

Related:
- Engines: `@desk/core` `desk/maintenance/` (scheduler, index updater, state refresher, rebuild)
- Trigger: `desk/domain-write-bus.ts` (published from the record-write funnel)
- Usage log: `desk/ai-usage.ts` via DeskService (`.desk/usage/ai-usage.json`)
