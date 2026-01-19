import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OrbitConfig } from "@/types";

interface SettingsState extends OrbitConfig {
  // Actions
  setDataPath: (path: string) => void;
  setCurrentWorkspaceId: (id: string | null) => void;
  setTheme: (theme: OrbitConfig["theme"]) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSetupCompleted: (completed: boolean) => void;
  reset: () => void;
}

const defaultSettings: OrbitConfig = {
  dataPath: "",
  currentWorkspaceId: null,
  theme: "system",
  sidebarCollapsed: false,
  setupCompleted: false,
};

// Get default data path based on platform
const getDefaultDataPath = (): string => {
  if (typeof window !== "undefined") {
    // In browser/Tauri context, we'll use ~/Orbit
    // This will be resolved properly when we integrate with Tauri fs API
    return "~/Orbit";
  }
  return "";
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      dataPath: getDefaultDataPath(),

      setDataPath: (path) => set({ dataPath: path }),
      setCurrentWorkspaceId: (id) => set({ currentWorkspaceId: id }),
      setTheme: (theme) => set({ theme }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSetupCompleted: (completed) => set({ setupCompleted: completed }),
      reset: () => set(defaultSettings),
    }),
    {
      name: "orbit-settings",
      // Only persist these fields
      partialize: (state) => ({
        dataPath: state.dataPath,
        currentWorkspaceId: state.currentWorkspaceId,
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        setupCompleted: state.setupCompleted,
      }),
    }
  )
);
