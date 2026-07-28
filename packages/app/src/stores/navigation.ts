import { create } from "zustand";
import { persist } from "zustand/middleware";
import { confirmUnsavedChanges } from "@/lib/unsaved-changes-guard";

interface NavigationState {
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string | null) => void;
  reset: () => void;
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      currentWorkspaceId: null,
      setCurrentWorkspaceId: (id) =>
        set((state) => {
          if (state.currentWorkspaceId === id || confirmUnsavedChanges()) {
            return { currentWorkspaceId: id };
          }
          return state;
        }),
      reset: () =>
        set((state) => confirmUnsavedChanges() ? { currentWorkspaceId: null } : state),
    }),
    {
      name: "desk-navigation",
      partialize: (state) => ({
        currentWorkspaceId: state.currentWorkspaceId,
      }),
    }
  )
);
