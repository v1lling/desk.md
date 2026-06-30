import { create } from "zustand";

/**
 * Ephemeral selection state for the Projects page.
 *
 * The projects secondary sidebar (`ProjectsTreePane`) and the main-pane overview
 * (`ProjectOverview`) are siblings with no shared parent but `AppShell`, so a
 * tiny store is the cleanest channel between them. Not persisted — selection is
 * resolved against the current workspace's project list on every render, so a
 * stale id simply falls back to the empty state.
 */
interface ProjectSelectionState {
  selectedProjectId: string | null;
  setSelectedProject: (id: string | null) => void;
}

export const useProjectSelectionStore = create<ProjectSelectionState>((set) => ({
  selectedProjectId: null,
  setSelectedProject: (id) => set({ selectedProjectId: id }),
}));
