import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18next from "i18next";

export type Language = "en" | "de" | "fr";

// Sidebar width constants
export const SIDEBAR_COLLAPSED_WIDTH = 56;
export const SIDEBAR_DEFAULT_WIDTH = 224;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 400;

// Secondary sidebar width constants (shared across all routes that opt into the slot)
export const SECONDARY_SIDEBAR_COLLAPSED_WIDTH = 32;
export const SECONDARY_SIDEBAR_DEFAULT_WIDTH = 280;
export const SECONDARY_SIDEBAR_MIN_WIDTH = 200;
export const SECONDARY_SIDEBAR_MAX_WIDTH = 480;

interface PreferencesState {
  theme: "light" | "dark" | "system";
  language: Language;
  sidebarWidth: number;
  workDayStartHour: number;
  workDayEndHour: number;
  showWeekends: boolean;
  /** Shared width for the secondary sidebar slot across all routes that opt in */
  secondarySidebarWidth: number;
  /** Shared collapsed state for the secondary sidebar slot */
  secondarySidebarCollapsed: boolean;
  /** Collapsed state of the planner's unscheduled-task rail */
  plannerRailCollapsed: boolean;
  /** Version of an update the user explicitly skipped — suppresses the launch toast */
  dismissedUpdateVersion: string | null;
  setTheme: (theme: PreferencesState["theme"]) => void;
  setLanguage: (language: Language) => void;
  setSidebarWidth: (width: number) => void;
  setWorkDayHours: (start: number, end: number) => void;
  setShowWeekends: (show: boolean) => void;
  setSecondarySidebarWidth: (width: number) => void;
  setSecondarySidebarCollapsed: (collapsed: boolean) => void;
  setPlannerRailCollapsed: (collapsed: boolean) => void;
  setDismissedUpdateVersion: (version: string | null) => void;
  reset: () => void;
}

const defaultPreferences = {
  theme: "system" as const,
  language: "en" as Language,
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  workDayStartHour: 9,
  workDayEndHour: 18,
  showWeekends: false,
  secondarySidebarWidth: SECONDARY_SIDEBAR_DEFAULT_WIDTH,
  secondarySidebarCollapsed: false,
  plannerRailCollapsed: false,
  dismissedUpdateVersion: null as string | null,
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...defaultPreferences,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => {
        set({ language });
        void i18next.changeLanguage(language);
      },
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setWorkDayHours: (start, end) =>
        set({ workDayStartHour: start, workDayEndHour: end }),
      setShowWeekends: (show) => set({ showWeekends: show }),
      setSecondarySidebarWidth: (width) => set({ secondarySidebarWidth: width }),
      setSecondarySidebarCollapsed: (collapsed) => set({ secondarySidebarCollapsed: collapsed }),
      setPlannerRailCollapsed: (collapsed) => set({ plannerRailCollapsed: collapsed }),
      setDismissedUpdateVersion: (version) => set({ dismissedUpdateVersion: version }),
      reset: () => set(defaultPreferences),
    }),
    {
      name: "desk-preferences",
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        sidebarWidth: state.sidebarWidth,
        workDayStartHour: state.workDayStartHour,
        workDayEndHour: state.workDayEndHour,
        showWeekends: state.showWeekends,
        secondarySidebarWidth: state.secondarySidebarWidth,
        secondarySidebarCollapsed: state.secondarySidebarCollapsed,
        dismissedUpdateVersion: state.dismissedUpdateVersion,
      }),
    }
  )
);
