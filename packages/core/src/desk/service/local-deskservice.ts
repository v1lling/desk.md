/**
 * LocalDeskService — the domain running in-process.
 *
 * This binds the @desk/core domain functions to the DeskService
 * contract. The functions are unchanged: they read/write through getStorage()
 * and keep their built-in browser dev-mock fallback (`if (!isTauri())`), so this
 * one implementation covers both the Tauri desktop app and browser/mock mode.
 *
 * The server (step 2) runs this exact object against a NodeFsProvider; the web /
 * native-hosted client uses a RemoteDeskService instead (step 3). Nothing here
 * changes for either — that is the point of the seam.
 */
import * as tasksApi from "../tasks";
import * as projectsApi from "../projects";
import * as workspacesApi from "../workspaces";
import * as meetingsApi from "../meetings";
import * as personalApi from "../personal";
import * as contentApi from "../content";
import * as dashboardApi from "../dashboard";
import * as viewStateApi from "../view-state";
import * as settingsApi from "../settings";
import * as agentQueriesApi from "../agent-queries";
import * as catalogApi from "../catalog";
import * as indexCacheApi from "../index-cache";
import * as aiignoreApi from "../aiignore";
import type { DeskService } from "./deskservice";

export const localDeskService: DeskService = {
  // Tasks
  getTasks: tasksApi.getTasks,
  getTasksByProject: tasksApi.getTasksByProject,
  getTask: tasksApi.getTask,
  createTask: tasksApi.createTask,
  updateTask: tasksApi.updateTask,
  deleteTask: tasksApi.deleteTask,
  moveTask: tasksApi.moveTask,
  moveTaskToProject: tasksApi.moveTaskToProject,

  // Projects
  getProjects: projectsApi.getProjects,
  getProject: projectsApi.getProject,
  createProject: projectsApi.createProject,
  updateProject: projectsApi.updateProject,
  deleteProject: projectsApi.deleteProject,
  getProjectStats: projectsApi.getProjectStats,

  // Workspaces
  getWorkspaces: workspacesApi.getWorkspaces,
  getWorkspace: workspacesApi.getWorkspace,
  createWorkspace: workspacesApi.createWorkspace,
  updateWorkspace: workspacesApi.updateWorkspace,
  deleteWorkspace: workspacesApi.deleteWorkspace,

  // Meetings
  getMeetings: meetingsApi.getMeetings,
  getMeetingsByProject: meetingsApi.getMeetingsByProject,
  getMeeting: meetingsApi.getMeeting,
  createMeeting: meetingsApi.createMeeting,
  updateMeeting: meetingsApi.updateMeeting,
  deleteMeeting: meetingsApi.deleteMeeting,
  moveMeetingToProject: meetingsApi.moveMeetingToProject,

  // Personal / capture inbox
  getCaptureTasks: personalApi.getCaptureTasks,
  createCaptureTask: personalApi.createCaptureTask,
  updateCaptureTask: personalApi.updateCaptureTask,
  deleteCaptureTask: personalApi.deleteCaptureTask,
  moveCaptureToPersonal: personalApi.moveCaptureToPersonal,
  moveCaptureToWorkspace: personalApi.moveCaptureToWorkspace,

  // Docs / content
  getDocs: contentApi.getDocs,
  getDocsByProject: contentApi.getDocsByProject,
  getDoc: contentApi.getDoc,
  createDoc: contentApi.createDoc,
  updateDoc: contentApi.updateDoc,
  deleteDoc: contentApi.deleteDoc,
  deleteAsset: contentApi.deleteAsset,

  // Content tree (I/O reads)
  getContentTree: contentApi.getContentTree,
  getAllDocs: contentApi.getAllDocs,
  getAllDocsForWorkspace: contentApi.getAllDocsForWorkspace,
  getWorkspaceOverviewShell: contentApi.getWorkspaceOverviewShell,
  getMergedContentTree: contentApi.getMergedContentTree,
  getMergedWorkspaceOverviewShell: contentApi.getMergedWorkspaceOverviewShell,

  // Content folders
  createFolder: contentApi.createFolder,
  renameFolder: contentApi.renameFolder,
  moveFolder: contentApi.moveFolder,
  deleteFolder: contentApi.deleteFolder,

  // Content import / move
  createDocInFolder: contentApi.createDocInFolder,
  importFiles: contentApi.importFiles,
  moveDoc: contentApi.moveDoc,

  // Dashboard / planner aggregators
  getFocusTasks: dashboardApi.getFocusTasks,
  getWorkspaceSummaries: dashboardApi.getWorkspaceSummaries,
  getAllWorkspaceTasks: dashboardApi.getAllWorkspaceTasks,
  getAllWorkspaceTasksAllStatuses: dashboardApi.getAllWorkspaceTasksAllStatuses,

  // View state (.view.json)
  getViewState: viewStateApi.getViewState,
  updateTaskOrder: viewStateApi.updateTaskOrder,
  removeTaskFromOrder: viewStateApi.removeTaskFromOrder,
  setViewMode: viewStateApi.setViewMode,
  setExpandedFolders: viewStateApi.setExpandedFolders,
  toggleTaskHighlight: viewStateApi.toggleTaskHighlight,
  setHiddenStatuses: viewStateApi.setHiddenStatuses,

  // Shared settings KV (.desk/settings/*.json)
  getSetting: settingsApi.getSetting,
  setSetting: settingsApi.setSetting,

  // Assistant read tools (agent-queries)
  deskWorkspaceInfo: agentQueriesApi.deskWorkspaceInfo,
  deskTree: agentQueriesApi.deskTree,
  deskReadFile: agentQueriesApi.deskReadFile,
  deskFullTextSearch: agentQueriesApi.deskFullTextSearch,

  // Catalog (always-complete, AI-free metadata index)
  buildWorkspaceCatalog: catalogApi.buildWorkspaceCatalog,

  // Smart Index cache (.desk/index/indexes.json)
  getIndexCache: indexCacheApi.getIndexCache,
  setIndexCache: indexCacheApi.setIndexCache,

  // .aiignore management (per-workspace AI exclusions)
  loadAIIgnoreEntries: aiignoreApi.loadAIIgnoreEntries,
  getAIInclusion: aiignoreApi.getAIInclusion,
  setAIInclusion: aiignoreApi.setAIInclusion,
  getAiExclusionState: aiignoreApi.getAiExclusionState,
  getFolderAIInclusion: aiignoreApi.getFolderAIInclusion,
  setFolderAIInclusion: aiignoreApi.setFolderAIInclusion,
};
