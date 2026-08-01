import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createRemoteSettingStorage } from "./remote-setting-storage";
import { normalizeAgentInstructionsSetting } from "@desk/core";

interface AgentInstructionsState {
  /** Inlined into the top-level CLAUDE.md / AGENTS.md / GEMINI.md marker block. */
  global: string;
  setGlobal: (value: string) => void;
}

export const useAgentInstructionsStore = create<AgentInstructionsState>()(
  persist(
    (set) => ({
      global: "",
      setGlobal: (value) => set({ global: value }),
    }),
    {
      name: "desk-agent-instructions",
      // User-level → shared across devices in hosted mode (.desk/settings/agent-instructions.json).
      storage: createRemoteSettingStorage<Pick<AgentInstructionsState, "global">>("agent-instructions"),
      version: 1,
      migrate: (persisted) => normalizeAgentInstructionsSetting(persisted),
      partialize: (state) => ({ global: state.global }),
    }
  )
);
