import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SummaryDetail } from "@/lib/context-index/constants";

interface ContextSettings {
  showToolDetails: boolean;
  autoSummarizeOnSave: boolean;
  generateAgentFiles: boolean;
  summaryDetail: SummaryDetail;
}

interface ContextState extends ContextSettings {
  setAutoSummarizeOnSave: (enabled: boolean) => void;
  setShowToolDetails: (enabled: boolean) => void;
  setGenerateAgentFiles: (enabled: boolean) => void;
  setSummaryDetail: (detail: SummaryDetail) => void;
  reset: () => void;
}

const defaultSettings: ContextSettings = {
  autoSummarizeOnSave: true,
  showToolDetails: true,
  generateAgentFiles: true,
  summaryDetail: "brief",
};

export const useContextStore = create<ContextState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setAutoSummarizeOnSave: (enabled) => set({ autoSummarizeOnSave: enabled }),
      setShowToolDetails: (enabled) => set({ showToolDetails: enabled }),
      setGenerateAgentFiles: (enabled) => set({ generateAgentFiles: enabled }),
      setSummaryDetail: (detail) => set({ summaryDetail: detail }),
      reset: () => set(defaultSettings),
    }),
    {
      name: "desk-context-settings",
      partialize: (state) => ({
        autoSummarizeOnSave: state.autoSummarizeOnSave,
        showToolDetails: state.showToolDetails,
        generateAgentFiles: state.generateAgentFiles,
        summaryDetail: state.summaryDetail,
      }),
    }
  )
);
