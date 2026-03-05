// ── Settings ────────────────────────────────────────────────────────
export { useSettingsStore } from "./settings";

// ── Workspaces ──────────────────────────────────────────────────────
export {
  useWorkspaces,
  useWorkspace,
  useCreateWorkspace,
  useUpdateWorkspace,
  useDeleteWorkspace,
  useCurrentWorkspace,
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
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
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
  usePersonalViewMode,
  useExpandedFolders,
  useHighlightedTasks,
  sortTasksByOrder,
  viewStateKeys,
} from "./view-state";

// ── Personal / Capture ──────────────────────────────────────────────
export {
  useCaptureTasks,
  useCreateCaptureTask,
  useUpdateCaptureTask,
  useDeleteCaptureTask,
  useMoveCaptureToPersonal,
  useMoveCaptureToWorkspace,
  isPersonalWorkspace,
  captureKeys,
  PERSONAL_WORKSPACE_ID,
} from "./personal";

// ── Dashboard ───────────────────────────────────────────────────────
export {
  useActiveTasks,
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
export { WORKSPACE_LEVEL_PROJECT_ID } from "@/lib/desk/constants";
