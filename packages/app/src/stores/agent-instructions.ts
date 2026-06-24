import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createRemoteSettingStorage } from "./remote-setting-storage";

interface AgentInstructionsState {
  /** Inlined into the top-level CLAUDE.md / AGENTS.md / GEMINI.md marker block. */
  global: string;
  /** Inlined into per-workspace CLAUDE.md / AGENTS.md / GEMINI.md marker block. Key = workspaceId. */
  perWorkspace: Record<string, string>;

  setGlobal: (value: string) => void;
  setForWorkspace: (workspaceId: string, value: string) => void;
  clearForWorkspace: (workspaceId: string) => void;
}

export const useAgentInstructionsStore = create<AgentInstructionsState>()(
  persist(
    (set) => ({
      global: "",
      perWorkspace: {},

      setGlobal: (value) => set({ global: value }),

      setForWorkspace: (workspaceId, value) =>
        set((state) => ({
          perWorkspace: { ...state.perWorkspace, [workspaceId]: value },
        })),

      clearForWorkspace: (workspaceId) =>
        set((state) => {
          const next = { ...state.perWorkspace };
          delete next[workspaceId];
          return { perWorkspace: next };
        }),
    }),
    {
      name: "desk-agent-instructions",
      // User-level → shared across devices in hosted mode (.desk/settings/agent-instructions.json).
      storage: createRemoteSettingStorage<Pick<AgentInstructionsState, "global" | "perWorkspace">>(
        "agent-instructions"
      ),
      partialize: (state) => ({
        global: state.global,
        perWorkspace: state.perWorkspace,
      }),
    }
  )
);
