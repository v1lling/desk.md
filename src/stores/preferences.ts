import { create } from "zustand";
import { persist } from "zustand/middleware";

// Sidebar width constants
export const SIDEBAR_COLLAPSED_WIDTH = 56;
export const SIDEBAR_DEFAULT_WIDTH = 224;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 400;

interface PreferencesState {
  theme: "light" | "dark" | "system";
  sidebarWidth: number;
  workDayStartHour: number;
  workDayEndHour: number;
  showWeekends: boolean;
  setTheme: (theme: PreferencesState["theme"]) => void;
  setSidebarWidth: (width: number) => void;
  setWorkDayHours: (start: number, end: number) => void;
  setShowWeekends: (show: boolean) => void;
  reset: () => void;
}

const defaultPreferences = {
  theme: "system" as const,
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  workDayStartHour: 9,
  workDayEndHour: 18,
  showWeekends: false,
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...defaultPreferences,
      setTheme: (theme) => set({ theme }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setWorkDayHours: (start, end) =>
        set({ workDayStartHour: start, workDayEndHour: end }),
      setShowWeekends: (show) => set({ showWeekends: show }),
      reset: () => set(defaultPreferences),
    }),
    {
      name: "desk-preferences",
      partialize: (state) => ({
        theme: state.theme,
        sidebarWidth: state.sidebarWidth,
        workDayStartHour: state.workDayStartHour,
        workDayEndHour: state.workDayEndHour,
        showWeekends: state.showWeekends,
      }),
    }
  )
);
