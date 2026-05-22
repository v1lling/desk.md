import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ContextSettings {
  showToolDetails: boolean;
  autoSummarizeOnSave: boolean;
  generateAgentFiles: boolean;
}

interface ContextState extends ContextSettings {
  setAutoSummarizeOnSave: (enabled: boolean) => void;
  setShowToolDetails: (enabled: boolean) => void;
  setGenerateAgentFiles: (enabled: boolean) => void;
  reset: () => void;
}

const defaultSettings: ContextSettings = {
  autoSummarizeOnSave: true,
  showToolDetails: true,
  generateAgentFiles: true,
};

export const useContextStore = create<ContextState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setAutoSummarizeOnSave: (enabled) => set({ autoSummarizeOnSave: enabled }),
      setShowToolDetails: (enabled) => set({ showToolDetails: enabled }),
      setGenerateAgentFiles: (enabled) => set({ generateAgentFiles: enabled }),
      reset: () => set(defaultSettings),
    }),
    {
      name: "desk-context-settings",
      partialize: (state) => ({
        autoSummarizeOnSave: state.autoSummarizeOnSave,
        showToolDetails: state.showToolDetails,
        generateAgentFiles: state.generateAgentFiles,
      }),
    }
  )
);
