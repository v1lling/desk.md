export { useSettingsStore } from "./settings";
export {
  useWorkspaces,
  useWorkspace,
  useCreateWorkspace,
  useUpdateWorkspace,
  useDeleteWorkspace,
  useCurrentWorkspace,
  workspaceKeys,
} from "./workspaces";
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
export {
  useProjects,
  useProject,
  useProjectStats,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  projectKeys,
} from "./projects";
export {
  useDocs,
  useProjectDocs,
  useDoc,
  useCreateDoc,
  useUpdateDoc,
  useDeleteDoc,
  useMoveDocToProject,
  docKeys,
  // Tree-based hooks
  useDocTree,
  useCreateDocFolder,
  useRenameDocFolder,
  useDeleteDocFolder,
  useMoveDoc,
  useCreateDocInFolder,
  useImportDocs,
  // Backwards compatibility aliases
  useNotes,
  useProjectNotes,
  useNote,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useMoveNoteToProject,
  noteKeys,
} from "./docs";
export {
  useMeetings,
  useProjectMeetings,
  useMeeting,
  useCreateMeeting,
  useUpdateMeeting,
  useDeleteMeeting,
  meetingKeys,
} from "./meetings";
export {
  useViewState,
  useUpdateTaskOrder,
  useRemoveTaskFromOrder,
  useViewMode,
  usePersonalViewMode,
  useExpandedDocFolders,
  sortTasksByOrder,
  viewStateKeys,
} from "./view-state";
export {
  useInboxTasks,
  useCreateInboxTask,
  useMoveFromInbox,
  useMoveFromInboxToWorkspace,
  usePersonalTasks,
  useAllPersonalTasks,
  useCreatePersonalTask,
  useUpdatePersonalTask,
  useDeletePersonalTask,
  useMovePersonalTask,
  groupPersonalTasksByStatus,
  isPersonalSpace,
  personalKeys,
  PERSONAL_SPACE_ID,
} from "./personal";
export {
  useActiveTasks,
  useWorkspaceSummaries,
  usePersonalSummary,
  dashboardKeys,
} from "./dashboard";
