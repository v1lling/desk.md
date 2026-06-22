// ── Settings ────────────────────────────────────────────────────────
export { useBootStore } from "./boot";
export { usePreferencesStore } from "./preferences";
export { useNavigationStore } from "./navigation";

// ── Workspaces ──────────────────────────────────────────────────────
export {
  useWorkspaces,
  useWorkspace,
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
  groupTasksByStatus,
  taskKeys,
} from "./tasks";

// ── Projects ────────────────────────────────────────────────────────
export {
  useProjects,
  useProject,
  useProjectStats,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  projectKeys,
} from "./projects";
export { useProjectSelectionStore } from "./project-selection";

// ── Content (Docs, Assets, Folders) ─────────────────────────────────
export {
  useDocs,
  useProjectDocs,
  useDoc,
  useCreateDoc,
  useUpdateDoc,
  useDeleteDoc,
  useDeleteAsset,
  useMoveDocToProject,
  useAllWorkspaceDocs,
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
  useExpandedFolders,
  useHighlightedTasks,
  useHiddenStatuses,
  sortTasksByOrder,
  viewStateKeys,
} from "./view-state";

// ── Capture ─────────────────────────────────────────────────────────
export {
  useCaptureTasks,
  useCreateCaptureTask,
  useUpdateCaptureTask,
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
