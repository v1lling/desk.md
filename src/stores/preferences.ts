import { create } from "zustand";
import { persist } from "zustand/middleware";

// Sidebar width constants
export const SIDEBAR_COLLAPSED_WIDTH = 56;
export const SIDEBAR_DEFAULT_WIDTH = 224;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 400;

// Secondary sidebar (per-route) width constants
export const SECONDARY_SIDEBAR_COLLAPSED_WIDTH = 32;
export const SECONDARY_SIDEBAR_DEFAULT_WIDTH = 280;
export const SECONDARY_SIDEBAR_MIN_WIDTH = 200;
export const SECONDARY_SIDEBAR_MAX_WIDTH = 480;

// Per-route preference maps are bounded so they can't accumulate stale pathname keys
// indefinitely. 32 routes is comfortably above any realistic adoption.
const SECONDARY_SIDEBAR_KEY_CAP = 32;

function capRecord<T>(record: Record<string, T>, key: string, value: T): Record<string, T> {
  // Drop the existing entry (if any) and re-add it at the end so insertion order
  // reflects most-recently-used. Then evict the oldest entries past the cap.
  // Route keys are pathname strings (non-integer), so JS preserves insertion order.
  const { [key]: _evicted, ...rest } = record;
  void _evicted;
  const next: Record<string, T> = { ...rest, [key]: value };
  const keys = Object.keys(next);
  if (keys.length <= SECONDARY_SIDEBAR_KEY_CAP) return next;
  const overflow = keys.length - SECONDARY_SIDEBAR_KEY_CAP;
  for (let i = 0; i < overflow; i++) delete next[keys[i]];
  return next;
}

interface PreferencesState {
  theme: "light" | "dark" | "system";
  sidebarWidth: number;
  workDayStartHour: number;
  workDayEndHour: number;
  showWeekends: boolean;
  /** Per-route width for the optional secondary sidebar slot */
  secondarySidebarWidths: Record<string, number>;
  /** Per-route collapsed state for the optional secondary sidebar slot */
  secondarySidebarCollapsed: Record<string, boolean>;
  setTheme: (theme: PreferencesState["theme"]) => void;
  setSidebarWidth: (width: number) => void;
  setWorkDayHours: (start: number, end: number) => void;
  setShowWeekends: (show: boolean) => void;
  setSecondarySidebarWidth: (routeKey: string, width: number) => void;
  setSecondarySidebarCollapsed: (routeKey: string, collapsed: boolean) => void;
  reset: () => void;
}

const defaultPreferences = {
  theme: "system" as const,
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  workDayStartHour: 9,
  workDayEndHour: 18,
  showWeekends: false,
  secondarySidebarWidths: {} as Record<string, number>,
  secondarySidebarCollapsed: {} as Record<string, boolean>,
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
      setSecondarySidebarWidth: (routeKey, width) =>
        set((state) => ({
          secondarySidebarWidths: capRecord(state.secondarySidebarWidths, routeKey, width),
        })),
      setSecondarySidebarCollapsed: (routeKey, collapsed) =>
        set((state) => ({
          secondarySidebarCollapsed: capRecord(state.secondarySidebarCollapsed, routeKey, collapsed),
        })),
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
        secondarySidebarWidths: state.secondarySidebarWidths,
        secondarySidebarCollapsed: state.secondarySidebarCollapsed,
      }),
    }
  )
);
