// ── Settings ────────────────────────────────────────────────────────
export { useBootStore } from "./boot";
export { usePreferencesStore } from "./preferences";
export { useNavigationStore } from "./navigation";

// ── Workspaces ──────────────────────────────────────────────────────
export {
  useWorkspaces,
  useCreateWorkspace,
  useUpdateWorkspace,
  useDeleteWorkspace,
  useCurrentWorkspace,
  useHomeWorkspace,
  workspaceKeys,
} from "./workspaces";

// ── Tasks ───────────────────────────────────────────────────────────
export {
  useTasks,
  useProjectTasks,
  useTask,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useMoveTask,
  useMoveTaskToProject,
  taskKeys,
} from "./tasks";

// ── Projects ────────────────────────────────────────────────────────
export {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  projectKeys,
} from "./projects";
export { useProjectSelectionStore } from "./project-selection";

// ── Content (Docs, Assets, Folders) ─────────────────────────────────
export {
  useDocs,
  useDoc,
  useCreateDoc,
  useUpdateDoc,
  useDeleteDoc,
  useDeleteAsset,
  contentKeys,
  useContentTree,
  useWorkspaceOverviewShell,
  useMergedWorkspaceOverviewShell,
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
  useMoveFolder,
  useMoveDoc,
  useCreateDocInFolder,
  useImportFiles,
  useFolderAIStates,
} from "./content";

// ── Meetings ────────────────────────────────────────────────────────
export {
  useMeetings,
  useProjectMeetings,
  useMeeting,
  useCreateMeeting,
  useUpdateMeeting,
  useDeleteMeeting,
  useMoveMeetingToProject,
  meetingKeys,
} from "./meetings";

// ── View State (task ordering, view modes, highlights) ──────────────
export {
  useViewState,
  useUpdateTaskOrder,
  useRemoveTaskFromOrder,
  useViewMode,
  useHighlightedTasks,
  useHiddenStatuses,
  sortTasksByOrder,
  viewStateKeys,
} from "./view-state";

// ── Capture ─────────────────────────────────────────────────────────
export {
  useCaptureTasks,
  useCreateCaptureTask,
  useDeleteCaptureTask,
  useMoveCaptureToPersonal,
  useMoveCaptureToWorkspace,
  captureKeys,
} from "./personal";

// ── Dashboard ───────────────────────────────────────────────────────
export {
  useFocusTasks,
  useWorkspaceSummaries,
  dashboardKeys,
} from "./dashboard";

// ── Tabs ────────────────────────────────────────────────────────────
export {
  useTabStore,
  useOpenTab,
  type TabItem,
  type TabType,
} from "./tabs";

// ── Re-exports ──────────────────────────────────────────────────────
export { WORKSPACE_LEVEL_PROJECT_ID } from "@desk/core";
