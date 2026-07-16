/**
 * AI maintenance settings — USER scope, shared across devices AND across engines.
 *
 * Persisted to `.desk/settings/ai-maintenance.json` via DeskService, because these toggles
 * steer whichever maintenance engine runs: the app's in local mode, the SERVER's in hosted
 * mode (core `desk/maintenance/config.ts` reads the same file, envelope-tolerantly). Flip a
 * toggle in any client and the owning engine obeys it at the next fire.
 *
 * Keys stay host-local (Keychain / server env); consent stays device-local (stores/ai.ts).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AI_MAINTENANCE_DEFAULTS, type AIProviderType, type SummaryDetail } from "@desk/core";
import { createRemoteSettingStorage } from "./remote-setting-storage";

interface AIMaintenanceSettingsState {
  autoSummarizeOnSave: boolean;
  autoRefreshProjectState: boolean;
  summaryDetail: SummaryDetail;
  providerType: AIProviderType;
  /** Model ID per provider (empty = provider default). */
  modelByProvider: Record<string, string>;
  setAutoSummarizeOnSave: (enabled: boolean) => void;
  setAutoRefreshProjectState: (enabled: boolean) => void;
  setSummaryDetail: (detail: SummaryDetail) => void;
  setProviderType: (type: AIProviderType) => void;
  setModelForProvider: (provider: AIProviderType, model: string) => void;
}

export const useAIMaintenanceSettingsStore = create<AIMaintenanceSettingsState>()(
  persist(
    (set) => ({
      // Defaults live once in core (AI_MAINTENANCE_DEFAULTS); the engine reads the same file.
      ...AI_MAINTENANCE_DEFAULTS,
      setAutoSummarizeOnSave: (enabled) => set({ autoSummarizeOnSave: enabled }),
      setAutoRefreshProjectState: (enabled) => set({ autoRefreshProjectState: enabled }),
      setSummaryDetail: (detail) => set({ summaryDetail: detail }),
      setProviderType: (type) => set({ providerType: type }),
      setModelForProvider: (provider, model) =>
        set((state) => ({
          modelByProvider: { ...state.modelByProvider, [provider]: model },
        })),
    }),
    {
      name: "desk-ai-maintenance",
      storage: createRemoteSettingStorage("ai-maintenance"),
      partialize: (state) => ({
        autoSummarizeOnSave: state.autoSummarizeOnSave,
        autoRefreshProjectState: state.autoRefreshProjectState,
        summaryDetail: state.summaryDetail,
        providerType: state.providerType,
        modelByProvider: state.modelByProvider,
      }),
    }
  )
);
