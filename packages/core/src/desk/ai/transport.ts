/**
 * The one provider transport: build the SDK model from the registry, call `generateText`, and
 * translate any failure into a typed `AIProviderError`. Replaces the old per-provider transport
 * files (`provider.ts` + `providers/openai.ts` + `providers/anthropic.ts`), which differed only
 * by the SDK factory and default model — both already captured by `registry.createModel`.
 */
import { generateText } from "ai";
import { getProviderDefinition } from "./provider-registry";
import { classifyAIError } from "./errors";
import type { AIProviderType, AIUsage } from "./types";

export interface ChatOptions {
  provider: AIProviderType;
  apiKey: string;
  model?: string;
  systemPrompt: string;
  message: string;
}

/**
 * Hard ceiling per provider call. Node's fetch has no idle timeout for a stalled-but-open
 * connection, so without this a single hung request would wedge whatever awaits it — a state
 * refresh, a whole index rebuild, or a manual "Refresh now" RPC — indefinitely.
 */
const CALL_TIMEOUT_MS = 60_000;

export async function runChat(opts: ChatOptions): Promise<{ message: string; usage?: AIUsage }> {
  const model = getProviderDefinition(opts.provider).createModel(opts.apiKey, opts.model);
  try {
    const { text, usage } = await generateText({
      model,
      system: opts.systemPrompt,
      messages: [{ role: "user", content: opts.message }],
      abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    // `!= null` (not truthiness): a legitimate `outputTokens: 0` must not discard the whole
    // usage record. Prefer the SDK's own total — it can include reasoning tokens the two
    // visible counts don't cover.
    const hasUsage = usage != null && (usage.inputTokens != null || usage.outputTokens != null);
    return {
      message: text,
      usage: hasUsage
        ? {
            promptTokens: usage.inputTokens ?? 0,
            completionTokens: usage.outputTokens ?? 0,
            totalTokens: usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
          }
        : undefined,
    };
  } catch (error) {
    throw classifyAIError(error, opts.provider);
  }
}
