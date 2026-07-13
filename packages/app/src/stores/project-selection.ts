import { create } from "zustand";

/**
 * Ephemeral selection state for the Projects page.
 *
 * The sidebar PROJECTS section and the /projects page (browse view or project
 * home) are siblings with no shared parent but `AppShell`, so a tiny store is
 * the cleanest channel between them. Not persisted.
 *
 * `AppShell` clears the selection on every workspace switch — project ids are
 * name slugs, not unique ids, so a stale id could otherwise resolve to a
 * different workspace's project.
 */
interface ProjectSelectionState {
  selectedProjectId: string | null;
  setSelectedProject: (id: string | null) => void;
}

export const useProjectSelectionStore = create<ProjectSelectionState>((set) => ({
  selectedProjectId: null,
  setSelectedProject: (id) => set({ selectedProjectId: id }),
}));
