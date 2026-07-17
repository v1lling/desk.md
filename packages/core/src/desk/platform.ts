/**
 * Pure runtime/platform detection — no filesystem or store dependencies.
 *
 * Kept dependency-free so both the storage registry (which picks a provider
 * based on isTauri) and env.ts (path/bootstrap helpers) can import it without
 * creating an import cycle.
 */

// Check if running in Tauri
export function isTauri(): boolean {
  // __TAURI_INTERNALS__ is the Tauri 2.x marker (always injected; no legacy fallback needed).
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Check if running on macOS (for title bar styling)
export function isMacOS(): boolean {
  if (typeof window === "undefined") return false;
  return navigator.userAgent.includes("Mac");
}

// Check if we need traffic light padding (macOS + Tauri with overlay title bar)
export function needsTrafficLightPadding(): boolean {
  return isTauri() && isMacOS();
}
