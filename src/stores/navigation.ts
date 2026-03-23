import { create } from "zustand";
import { persist } from "zustand/middleware";

interface NavigationState {
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string | null) => void;
  reset: () => void;
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      currentWorkspaceId: null,
      setCurrentWorkspaceId: (id) => set({ currentWorkspaceId: id }),
      reset: () => set({ currentWorkspaceId: null }),
    }),
    {
      name: "desk-navigation",
      partialize: (state) => ({
        currentWorkspaceId: state.currentWorkspaceId,
      }),
    }
  )
);
