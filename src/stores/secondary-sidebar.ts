import type { ReactNode } from "react";
import { create } from "zustand";

interface SecondarySidebarState {
  content: ReactNode | null;
  routeKey: string | null;
  setSlot: (routeKey: string, content: ReactNode) => void;
  clearSlot: (routeKey: string) => void;
}

export const useSecondarySidebarStore = create<SecondarySidebarState>((set, get) => ({
  content: null,
  routeKey: null,
  setSlot: (routeKey, content) => set({ routeKey, content }),
  clearSlot: (routeKey) => {
    if (get().routeKey === routeKey) {
      set({ routeKey: null, content: null });
    }
  },
}));
