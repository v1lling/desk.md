import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WorkspaceIndex, IndexEntry, BuildIndexResult } from "@/lib/context-index/types";
import { createRemoteIndexStorage } from "./remote-setting-storage";

/** Last full-rebuild result, persisted so the status panel survives navigation. */
export type LastBuildResult = BuildIndexResult & { at: string };

interface ContextIndexState {
  indexes: Record<string, WorkspaceIndex>;
  isBuilding: boolean;
  lastResult: LastBuildResult | null;

  setIndex: (workspaceId: string, index: WorkspaceIndex) => void;
  removeIndex: (workspaceId: string) => void;
  getIndex: (workspaceId: string) => WorkspaceIndex | undefined;
  updateEntry: (workspaceId: string, entry: IndexEntry) => void;
  removeEntry: (workspaceId: string, filePath: string) => void;
  setIsBuilding: (building: boolean) => void;
  setLastResult: (result: LastBuildResult | null) => void;
}

export const useContextIndexStore = create<ContextIndexState>()(
  persist(
    (set, get) => ({
      indexes: {},
      isBuilding: false,
      lastResult: null,

      setIndex: (workspaceId, index) =>
        set((state) => ({
          indexes: { ...state.indexes, [workspaceId]: index },
        })),

      removeIndex: (workspaceId) =>
        set((state) => {
          const rest = { ...state.indexes };
          delete rest[workspaceId];
          return { indexes: rest };
        }),

      getIndex: (workspaceId) => get().indexes[workspaceId],

      updateEntry: (workspaceId, entry) =>
        set((state) => {
          const index = state.indexes[workspaceId];
          if (!index) return state;

          const existingIdx = index.entries.findIndex((e) => e.filePath === entry.filePath);
          const newEntries = [...index.entries];
          if (existingIdx >= 0) {
            newEntries[existingIdx] = entry;
          } else {
            newEntries.push(entry);
          }

          return {
            indexes: {
              ...state.indexes,
              [workspaceId]: {
                ...index,
                entries: newEntries,
                fileCount: newEntries.length,
                // Bump so the UI reflects background auto-summary updates, not just rebuilds.
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      removeEntry: (workspaceId, filePath) =>
        set((state) => {
          const index = state.indexes[workspaceId];
          if (!index) return state;

          const newEntries = index.entries.filter((e) => e.filePath !== filePath);
          return {
            indexes: {
              ...state.indexes,
              [workspaceId]: {
                ...index,
                entries: newEntries,
                fileCount: newEntries.length,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      setIsBuilding: (building) => set({ isBuilding: building }),
      setLastResult: (result) => set({ lastResult: result }),
    }),
    {
      name: "desk-context-index",
      // DERIVED cache, but routed through DeskService so it follows the domain
      // (server-side `.desk/index/indexes.json` in hosted mode, where the catalog
      // tool / MCP read it; local disk in Tauri local mode).
      storage: createRemoteIndexStorage(),
    }
  )
);
