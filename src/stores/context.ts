import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ContextSettings {
  showToolDetails: boolean;
  autoSummarizeOnSave: boolean;
}

interface ContextState extends ContextSettings {
  setAutoSummarizeOnSave: (enabled: boolean) => void;
  setShowToolDetails: (enabled: boolean) => void;
  reset: () => void;
}

const defaultSettings: ContextSettings = {
  autoSummarizeOnSave: true,
  showToolDetails: true,
};

export const useContextStore = create<ContextState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setAutoSummarizeOnSave: (enabled) => set({ autoSummarizeOnSave: enabled }),
      setShowToolDetails: (enabled) => set({ showToolDetails: enabled }),
      reset: () => set(defaultSettings),
    }),
    {
      name: "desk-context-settings",
      partialize: (state) => ({
        autoSummarizeOnSave: state.autoSummarizeOnSave,
        showToolDetails: state.showToolDetails,
      }),
    }
  )
);
