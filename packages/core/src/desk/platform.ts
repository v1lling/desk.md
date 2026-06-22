/**
 * Pure runtime/platform detection — no filesystem or store dependencies.
 *
 * Kept dependency-free so both the storage registry (which picks a provider
 * based on isTauri) and env.ts (path/bootstrap helpers) can import it without
 * creating an import cycle.
 */

// Check if running in Tauri
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;

  // __TAURI_INTERNALS__ is the Tauri 2.x marker
  if ("__TAURI_INTERNALS__" in window) return true;

  // Fallback to __TAURI__ for compatibility
  if ("__TAURI__" in window) return true;

  return false;
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
