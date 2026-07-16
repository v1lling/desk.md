/**
 * AI key resolution — an injectable host seam (SEAM pattern, like editor-notifier).
 *
 * The AI service layer is runtime-agnostic; the one thing that differs per host is where the
 * provider API key lives:
 *   - Tauri app     → OS Keychain (app/lib/ai/secrets.ts, wired in main.tsx)
 *   - @desk/server  → environment (ANTHROPIC_API_KEY / OPENAI_API_KEY, wired in boot.ts)
 *   - browser mock  → nowhere (default resolver returns null; AI features stay off)
 *
 * The default returns null rather than throwing: "no key" is a normal, representable state that
 * every caller already handles (metadata-only indexing, disabled refresh buttons).
 */

export type AIKeyRef = "ai.openai" | "ai.anthropic";

export type AIKeyResolver = (keyRef: AIKeyRef) => Promise<string | null>;

let resolver: AIKeyResolver = async () => null;

export function setAIKeyResolver(r: AIKeyResolver): void {
  resolver = r;
}

export function getAIKeyResolver(): AIKeyResolver {
  return resolver;
}
