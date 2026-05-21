import { create } from "zustand";
import { useAISettingsStore } from "./ai";

// =============================================================================
// AI Consent Dialog Store (ephemeral — not persisted)
//
// Holds the open/closed state of the one-time AI privacy consent dialog and the
// pending promise that `ensureAIConsent()` awaits. The persisted "has consented"
// flag itself lives in `useAISettingsStore.aiConsentGiven`.
// =============================================================================

// Module-level resolver for the in-flight consent request. Kept outside the
// store so it is never serialized and there is only ever one pending request.
let pendingResolve: ((granted: boolean) => void) | null = null;

interface AIConsentState {
  isOpen: boolean;
  /** Open the dialog; resolves true if the user accepts, false otherwise. */
  request: () => Promise<boolean>;
  /** Called by the dialog buttons to settle the pending request. */
  resolve: (granted: boolean) => void;
}

export const useAIConsentStore = create<AIConsentState>((set) => ({
  isOpen: false,
  request: () => {
    // A request is already in flight — reuse its promise rather than opening twice.
    if (pendingResolve) {
      return new Promise<boolean>((resolve) => {
        const prev = pendingResolve!;
        pendingResolve = (granted) => {
          prev(granted);
          resolve(granted);
        };
      });
    }
    return new Promise<boolean>((resolve) => {
      pendingResolve = resolve;
      set({ isOpen: true });
    });
  },
  resolve: (granted) => {
    set({ isOpen: false });
    pendingResolve?.(granted);
    pendingResolve = null;
  },
}));

/**
 * Ensure the user has acknowledged the AI privacy disclosure before any content
 * is sent to an external AI provider.
 *
 * Returns immediately with `true` if consent was already given. Otherwise it
 * opens the consent dialog and resolves with the user's choice — persisting the
 * flag when accepted. Callers should abort the AI action when this returns false.
 */
export async function ensureAIConsent(): Promise<boolean> {
  if (useAISettingsStore.getState().aiConsentGiven) return true;
  const granted = await useAIConsentStore.getState().request();
  if (granted) useAISettingsStore.getState().setAIConsentGiven(true);
  return granted;
}
