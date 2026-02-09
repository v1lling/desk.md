import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WorkspaceIndex, IndexEntry } from "@/lib/context-index/types";

interface ContextIndexState {
  indexes: Record<string, WorkspaceIndex>;
  isBuilding: boolean;

  setIndex: (workspaceId: string, index: WorkspaceIndex) => void;
  removeIndex: (workspaceId: string) => void;
  getIndex: (workspaceId: string) => WorkspaceIndex | undefined;
  updateEntry: (workspaceId: string, entry: IndexEntry) => void;
  removeEntry: (workspaceId: string, filePath: string) => void;
  setIsBuilding: (building: boolean) => void;
}

export const useContextIndexStore = create<ContextIndexState>()(
  persist(
    (set, get) => ({
      indexes: {},
      isBuilding: false,

      setIndex: (workspaceId, index) =>
        set((state) => ({
          indexes: { ...state.indexes, [workspaceId]: index },
        })),

      removeIndex: (workspaceId) =>
        set((state) => {
          const { [workspaceId]: _, ...rest } = state.indexes;
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
              },
            },
          };
        }),

      setIsBuilding: (building) => set({ isBuilding: building }),
    }),
    {
      name: "desk-context-index",
    }
  )
);
