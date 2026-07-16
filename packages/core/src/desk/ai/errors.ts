/**
 * Typed AI provider errors — one classification point for every AI call.
 *
 * The Vercel AI SDK throws provider-specific errors (an `APICallError`, often wrapped in a
 * `RetryError` after retries) whose messages are raw provider prose ("You exceeded your current
 * quota, please check your plan and billing details. For more information..."). Surfacing that
 * verbatim is both ugly and, from the server, unsafe. Instead every provider call funnels through
 * `classifyAIError`, which maps whatever the SDK threw to a small machine `code` plus a clean,
 * self-authored message. Downstream — the maintenance engine, the server RPC layer, the Settings
 * UI — branches on `code`, so a new provider (Ollama, …) is covered the moment its errors carry
 * the same HTTP shape. No per-call, per-provider error handling anywhere else.
 */
import type { AIProviderType } from "./types";

export type AIErrorCode =
  | "quota" // out of credits / billing (429 + insufficient_quota)
  | "auth" // bad or missing key (401/403)
  | "rate-limit" // too many requests (429, retryable)
  | "network" // couldn't reach the provider (fetch/DNS/timeout)
  | "model-not-found" // the selected model id doesn't exist (404)
  | "unknown";

export class AIProviderError extends Error {
  constructor(
    readonly code: AIErrorCode,
    readonly provider: AIProviderType,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export function isAIProviderError(error: unknown): error is AIProviderError {
  return error instanceof AIProviderError;
}

/** Unwrap RetryError/AISDKError wrappers to the underlying provider error. */
function rootCause(error: unknown): unknown {
  let current = error;
  const seen = new Set<unknown>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const next = (current as { lastError?: unknown; cause?: unknown }).lastError
      ?? (current as { cause?: unknown }).cause;
    if (!next) break;
    current = next;
  }
  return current;
}

function statusOf(error: unknown): number | undefined {
  const e = error as { statusCode?: number; status?: number } | null;
  return e?.statusCode ?? e?.status;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : String(error ?? "");
}

/**
 * Map any thrown value from a provider call to a typed `AIProviderError` with a clean message.
 * Inspects both the outer error and its unwrapped root cause, keyed on HTTP status first
 * (provider-agnostic) then message text (the fallback when the SDK loses the status).
 */
export function classifyAIError(error: unknown, provider: AIProviderType): AIProviderError {
  if (isAIProviderError(error)) return error;

  const root = rootCause(error);
  const status = statusOf(root) ?? statusOf(error);
  const text = `${messageOf(root)} ${messageOf(error)}`.toLowerCase();

  const looksQuota = /quota|insufficient_quota|billing|exceeded your current/.test(text);
  // \b40[13]\b, not bare "401|403": the digits must be a standalone token, or any message
  // containing them inside a larger number (token counts, ids) misclassifies as auth.
  const looksAuth = /invalid api key|incorrect api key|unauthorized|authentication|invalid_api_key|\b40[13]\b/.test(text);
  const looksModel = /model.*(not found|does not exist|unknown)|no such model/.test(text);
  // "aborted"/"timeout" covers AbortSignal.timeout from the transport's per-call ceiling.
  const looksNetwork = /fetch failed|network|econnrefused|enotfound|etimedout|timed out|timeout|aborted|socket hang up/.test(text);

  let code: AIErrorCode = "unknown";
  if (status === 429) code = looksQuota ? "quota" : "rate-limit";
  else if (status === 401 || status === 403) code = "auth";
  else if (status === 404 && looksModel) code = "model-not-found";
  else if (looksQuota) code = "quota";
  else if (looksAuth) code = "auth";
  else if (looksModel) code = "model-not-found";
  else if (looksNetwork) code = "network";

  return new AIProviderError(code, provider, MESSAGES[code](provider), error);
}

const label: Record<AIProviderType, string> = { openai: "OpenAI", anthropic: "Anthropic" };

/** Clean, self-authored messages (safe to expose from the server; UI prefers the code mapping). */
const MESSAGES: Record<AIErrorCode, (p: AIProviderType) => string> = {
  quota: (p) => `${label[p]} quota exceeded — check your plan and billing.`,
  auth: (p) => `${label[p]} rejected the API key — check that it is valid.`,
  "rate-limit": (p) => `${label[p]} rate limit hit — try again shortly.`,
  network: (p) => `Couldn't reach ${label[p]} — check the network connection.`,
  "model-not-found": (p) => `The selected ${label[p]} model isn't available.`,
  unknown: (p) => `${label[p]} request failed.`,
};
