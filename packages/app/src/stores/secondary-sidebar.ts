import type { ReactNode } from "react";
import { create } from "zustand";

interface SecondarySidebarState {
  /** Registered slot content keyed by route path or a tab-context key (e.g. "assistant"). */
  slots: Record<string, ReactNode>;
  setSlot: (key: string, content: ReactNode) => void;
  clearSlot: (key: string) => void;
}

export const useSecondarySidebarStore = create<SecondarySidebarState>((set) => ({
  slots: {},
  setSlot: (key, content) =>
    set((s) => ({ slots: { ...s.slots, [key]: content } })),
  clearSlot: (key) =>
    set((s) => {
      if (!(key in s.slots)) return s;
      const next = { ...s.slots };
      delete next[key];
      return { slots: next };
    }),
}));
