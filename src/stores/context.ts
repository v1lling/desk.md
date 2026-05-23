import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SummaryDetail } from "@/lib/context-index/constants";

interface ContextSettings {
  showToolDetails: boolean;
  autoSummarizeOnSave: boolean;
  /** Emit ~/Desk/CLAUDE.md (and per-workspace) for Claude Code. */
  emitClaudeMd: boolean;
  /** Emit ~/Desk/AGENTS.md (and per-workspace) for Codex / OpenAI. */
  emitAgentsMd: boolean;
  /** Emit ~/Desk/GEMINI.md (and per-workspace) for Gemini CLI. */
  emitGeminiMd: boolean;
  summaryDetail: SummaryDetail;
}

interface ContextState extends ContextSettings {
  setAutoSummarizeOnSave: (enabled: boolean) => void;
  setShowToolDetails: (enabled: boolean) => void;
  setEmitClaudeMd: (enabled: boolean) => void;
  setEmitAgentsMd: (enabled: boolean) => void;
  setEmitGeminiMd: (enabled: boolean) => void;
  setSummaryDetail: (detail: SummaryDetail) => void;
  reset: () => void;
}

const defaultSettings: ContextSettings = {
  autoSummarizeOnSave: true,
  showToolDetails: true,
  emitClaudeMd: true,
  emitAgentsMd: true,
  emitGeminiMd: true,
  summaryDetail: "brief",
};

/** True if any of the three agent files should be written. Convenience for callers. */
export function anyAgentFileEnabled(): boolean {
  const s = useContextStore.getState();
  return s.emitClaudeMd || s.emitAgentsMd || s.emitGeminiMd;
}

export const useContextStore = create<ContextState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setAutoSummarizeOnSave: (enabled) => set({ autoSummarizeOnSave: enabled }),
      setShowToolDetails: (enabled) => set({ showToolDetails: enabled }),
      setEmitClaudeMd: (enabled) => set({ emitClaudeMd: enabled }),
      setEmitAgentsMd: (enabled) => set({ emitAgentsMd: enabled }),
      setEmitGeminiMd: (enabled) => set({ emitGeminiMd: enabled }),
      setSummaryDetail: (detail) => set({ summaryDetail: detail }),
      reset: () => set(defaultSettings),
    }),
    {
      name: "desk-context-settings-v2",
      partialize: (state) => ({
        autoSummarizeOnSave: state.autoSummarizeOnSave,
        showToolDetails: state.showToolDetails,
        emitClaudeMd: state.emitClaudeMd,
        emitAgentsMd: state.emitAgentsMd,
        emitGeminiMd: state.emitGeminiMd,
        summaryDetail: state.summaryDetail,
      }),
    }
  )
);
