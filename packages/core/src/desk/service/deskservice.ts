/**
 * DeskService — SEAM 2: the domain-operation contract.
 *
 * Where SEAM 1 (StorageProvider / getStorage) abstracts *where the bytes live*,
 * SEAM 2 abstracts *whether the domain runs in-process or remote*:
 *
 *   - LocalDeskService  — runs the domain in-process on a StorageProvider (today;
 *                         see local-deskservice.ts). This is the Tauri app and the
 *                         browser dev-mock mode.
 *   - RemoteDeskService — a thin fetch client to a server that runs the *same*
 *                         LocalDeskService over NodeFsProvider (added with the
 *                         server; not built yet).
 *
 * The active implementation is resolved via getDeskService() (see index.ts); a
 * server injects RemoteDeskService with setDeskService() at boot.
 *
 * The method signatures are derived (via `typeof`) from the existing domain
 * functions so the contract is single-sourced and cannot drift. Only I/O domain
 * operations belong here — pure helpers (extractDocs, prefixSubtreePaths, …) and
 * local-only cache utilities (clearHomeWorkspaceCache) are NOT service methods and
 * stay as direct imports.
 */
import type * as tasksApi from "../tasks";
import type * as projectsApi from "../projects";
import type * as workspacesApi from "../workspaces";
import type * as meetingsApi from "../meetings";
import type * as personalApi from "../personal";
import type * as contentApi from "../content";
import type * as dashboardApi from "../dashboard";

export interface DeskService {
  // ── Tasks ───────────────────────────────────────────────────────────
  getTasks: typeof tasksApi.getTasks;
  getTasksByProject: typeof tasksApi.getTasksByProject;
  getTask: typeof tasksApi.getTask;
  createTask: typeof tasksApi.createTask;
  updateTask: typeof tasksApi.updateTask;
  deleteTask: typeof tasksApi.deleteTask;
  moveTask: typeof tasksApi.moveTask;
  moveTaskToProject: typeof tasksApi.moveTaskToProject;

  // ── Projects ────────────────────────────────────────────────────────
  getProjects: typeof projectsApi.getProjects;
  getProject: typeof projectsApi.getProject;
  createProject: typeof projectsApi.createProject;
  updateProject: typeof projectsApi.updateProject;
  deleteProject: typeof projectsApi.deleteProject;
  getProjectStats: typeof projectsApi.getProjectStats;

  // ── Workspaces ──────────────────────────────────────────────────────
  getWorkspaces: typeof workspacesApi.getWorkspaces;
  getWorkspace: typeof workspacesApi.getWorkspace;
  createWorkspace: typeof workspacesApi.createWorkspace;
  updateWorkspace: typeof workspacesApi.updateWorkspace;
  deleteWorkspace: typeof workspacesApi.deleteWorkspace;

  // ── Meetings ────────────────────────────────────────────────────────
  getMeetings: typeof meetingsApi.getMeetings;
  getMeetingsByProject: typeof meetingsApi.getMeetingsByProject;
  getMeeting: typeof meetingsApi.getMeeting;
  createMeeting: typeof meetingsApi.createMeeting;
  updateMeeting: typeof meetingsApi.updateMeeting;
  deleteMeeting: typeof meetingsApi.deleteMeeting;
  moveMeetingToProject: typeof meetingsApi.moveMeetingToProject;

  // ── Personal / capture inbox ────────────────────────────────────────
  getCaptureTasks: typeof personalApi.getCaptureTasks;
  createCaptureTask: typeof personalApi.createCaptureTask;
  updateCaptureTask: typeof personalApi.updateCaptureTask;
  deleteCaptureTask: typeof personalApi.deleteCaptureTask;
  moveCaptureToPersonal: typeof personalApi.moveCaptureToPersonal;
  moveCaptureToWorkspace: typeof personalApi.moveCaptureToWorkspace;

  // ── Docs / content (content.ts re-exports the content-* I/O ops) ─────
  getDocs: typeof contentApi.getDocs;
  getDocsByProject: typeof contentApi.getDocsByProject;
  getDoc: typeof contentApi.getDoc;
  createDoc: typeof contentApi.createDoc;
  updateDoc: typeof contentApi.updateDoc;
  deleteDoc: typeof contentApi.deleteDoc;
  deleteAsset: typeof contentApi.deleteAsset;

  // ── Content tree (I/O reads) ────────────────────────────────────────
  getContentTree: typeof contentApi.getContentTree;
  getAllDocs: typeof contentApi.getAllDocs;
  getAllDocsForWorkspace: typeof contentApi.getAllDocsForWorkspace;
  getWorkspaceOverviewShell: typeof contentApi.getWorkspaceOverviewShell;
  getMergedContentTree: typeof contentApi.getMergedContentTree;
  getMergedWorkspaceOverviewShell: typeof contentApi.getMergedWorkspaceOverviewShell;

  // ── Content folders ─────────────────────────────────────────────────
  createFolder: typeof contentApi.createFolder;
  renameFolder: typeof contentApi.renameFolder;
  moveFolder: typeof contentApi.moveFolder;
  deleteFolder: typeof contentApi.deleteFolder;

  // ── Content import / move ───────────────────────────────────────────
  createDocInFolder: typeof contentApi.createDocInFolder;
  importFiles: typeof contentApi.importFiles;
  moveDocToProject: typeof contentApi.moveDocToProject;
  moveDoc: typeof contentApi.moveDoc;

  // ── Dashboard / planner aggregators (cross-workspace reads) ─────────
  // Promoted to service methods so they run server-side in hosted mode (one
  // round-trip), instead of fanning out N+1 domain calls from the client.
  getFocusTasks: typeof dashboardApi.getFocusTasks;
  getWorkspaceSummaries: typeof dashboardApi.getWorkspaceSummaries;
  getAllWorkspaceTasks: typeof dashboardApi.getAllWorkspaceTasks;
  getAllWorkspaceTasksAllStatuses: typeof dashboardApi.getAllWorkspaceTasksAllStatuses;
}
