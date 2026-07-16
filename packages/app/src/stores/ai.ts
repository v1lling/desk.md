import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AIPurpose, AIUsage } from "@desk/core";

// =============================================================================
// AI device state (persisted, localStorage)
// =============================================================================
// DEVICE scope only: whether the user acknowledged the privacy disclosure on THIS machine.
// Whether a provider key exists is NOT mirrored here — it is read live from the host that owns
// the data via `useAIMaintenanceInfo()` (getAIMaintenanceInfo). Provider/model selection and the
// maintenance toggles are USER scope and live in stores/ai-maintenance-settings.ts.

interface AISettingsState {
  /** True once the user has acknowledged the AI privacy disclosure. */
  aiConsentGiven: boolean;
  setAIConsentGiven: (given: boolean) => void;
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      aiConsentGiven: false,
      setAIConsentGiven: (given) => set({ aiConsentGiven: given }),
    }),
    {
      name: "desk-ai-settings-v2",
      partialize: (state) => ({ aiConsentGiven: state.aiConsentGiven }),
    }
  )
);

export type { AIPurpose, AIUsage };
