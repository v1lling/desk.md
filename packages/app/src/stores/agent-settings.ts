/**
 * Agent-file settings — DEVICE scope (localStorage). The emit toggles only do anything on a
 * local disk (generated agent files are a local-mode feature), so they stay per-machine.
 * The AI maintenance toggles (auto-summarize, state auto-refresh, summary detail) are USER
 * scope and live in stores/ai-maintenance-settings.ts.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AgentSettings {
  /** Emit ~/Desk/CLAUDE.md (and per-workspace) for Claude Code. */
  emitClaudeMd: boolean;
  /** Emit ~/Desk/AGENTS.md (and per-workspace) for Codex / OpenAI. */
  emitAgentsMd: boolean;
  /** Emit ~/Desk/GEMINI.md (and per-workspace) for Gemini CLI. */
  emitGeminiMd: boolean;
}

interface AgentSettingsState extends AgentSettings {
  setEmitClaudeMd: (enabled: boolean) => void;
  setEmitAgentsMd: (enabled: boolean) => void;
  setEmitGeminiMd: (enabled: boolean) => void;
}

const defaultSettings: AgentSettings = {
  emitClaudeMd: true,
  emitAgentsMd: true,
  emitGeminiMd: true,
};

/** True if any of the three agent files should be written. Convenience for callers. */
export function anyAgentFileEnabled(): boolean {
  const s = useAgentSettingsStore.getState();
  return s.emitClaudeMd || s.emitAgentsMd || s.emitGeminiMd;
}

export const useAgentSettingsStore = create<AgentSettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setEmitClaudeMd: (enabled) => set({ emitClaudeMd: enabled }),
      setEmitAgentsMd: (enabled) => set({ emitAgentsMd: enabled }),
      setEmitGeminiMd: (enabled) => set({ emitGeminiMd: enabled }),
    }),
    {
      // Kept from the pre-rename store on purpose: changing the key would silently reset the
      // user's toggles for no benefit.
      name: "desk-context-settings-v2",
      partialize: (state) => ({
        emitClaudeMd: state.emitClaudeMd,
        emitAgentsMd: state.emitAgentsMd,
        emitGeminiMd: state.emitGeminiMd,
      }),
    }
  )
);
