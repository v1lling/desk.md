/**
 * Turn any thrown value from an AI-backed call into a user-facing string.
 *
 * Typed provider errors (`AIProviderError`, whether thrown in-process locally or reconstructed
 * from the server RPC) map by `code` to a localized message; a translation missing for a code
 * falls back to the error's own self-authored message. Anything else returns its raw message.
 * One helper for every AI surface (state refresh, index rebuild), so the mapping lives once.
 */
import { isAIProviderError } from "@desk/core";

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export function describeAIError(error: unknown, t: TFunction): string | undefined {
  if (isAIProviderError(error)) {
    return t(`errors.ai.${error.code}`, { defaultValue: error.message });
  }
  return error instanceof Error ? error.message : undefined;
}
