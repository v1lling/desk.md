import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BootState {
  dataPath: string;
  setupCompleted: boolean;
  setDataPath: (path: string) => void;
  setSetupCompleted: (completed: boolean) => void;
  reset: () => void;
}

const getDefaultDataPath = (): string => {
  if (typeof window !== "undefined") {
    return "~/Desk";
  }
  return "";
};

const defaultBoot = {
  dataPath: getDefaultDataPath(),
  setupCompleted: false,
};

export const useBootStore = create<BootState>()(
  persist(
    (set) => ({
      ...defaultBoot,
      setDataPath: (path) => set({ dataPath: path }),
      setSetupCompleted: (completed) => set({ setupCompleted: completed }),
      reset: () => set(defaultBoot),
    }),
    {
      name: "desk-boot",
      partialize: (state) => ({
        dataPath: state.dataPath,
        setupCompleted: state.setupCompleted,
      }),
    }
  )
);
