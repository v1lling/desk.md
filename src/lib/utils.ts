import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert an unknown thrown value into a human-readable message.
 *
 * `String(error)` on a plain object yields the useless "[object Object]".
 * API/streaming errors (e.g. the Anthropic SSE `error` event surfaced by the
 * AI SDK) arrive as plain `{ type, message }` objects, so we dig out the
 * message before falling back to a JSON dump.
 */
export function formatError(error: unknown): string {
  if (error == null) return "Unknown error"
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message || error.name || "Error"

  if (typeof error === "object") {
    const obj = error as Record<string, unknown>
    // Common API error shapes: { message }, { error: "..." }, { error: { message } }
    if (typeof obj.message === "string" && obj.message) return obj.message
    if (typeof obj.error === "string" && obj.error) return obj.error
    if (obj.error && typeof obj.error === "object") {
      const nested = obj.error as Record<string, unknown>
      if (typeof nested.message === "string" && nested.message) return nested.message
    }
    try {
      const json = JSON.stringify(error)
      if (json && json !== "{}") return json
    } catch {
      // fall through to String()
    }
  }

  return String(error)
}
