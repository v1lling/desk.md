import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OrbitConfig } from "@/types";

// Sidebar width constants
export const SIDEBAR_COLLAPSED_WIDTH = 56;
export const SIDEBAR_DEFAULT_WIDTH = 224;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 400;

interface SettingsState extends OrbitConfig {
  // Actions
  setDataPath: (path: string) => void;
  setCurrentWorkspaceId: (id: string | null) => void;
  setTheme: (theme: OrbitConfig["theme"]) => void;
  setSidebarWidth: (width: number) => void;
  setSetupCompleted: (completed: boolean) => void;
  reset: () => void;
}

const defaultSettings: OrbitConfig = {
  dataPath: "",
  currentWorkspaceId: null,
  theme: "system",
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
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
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
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
        sidebarWidth: state.sidebarWidth,
        setupCompleted: state.setupCompleted,
      }),
      // Migrate from old sidebarCollapsed boolean to sidebarWidth
      migrate: (persistedState) => {
        const state = persistedState as Record<string, unknown>;
        // Handle legacy sidebarCollapsed field
        if ("sidebarCollapsed" in state && !("sidebarWidth" in state)) {
          state.sidebarWidth = state.sidebarCollapsed
            ? SIDEBAR_COLLAPSED_WIDTH
            : SIDEBAR_DEFAULT_WIDTH;
          delete state.sidebarCollapsed;
        }
        return state as unknown as SettingsState;
      },
      version: 1,
    }
  )
);
