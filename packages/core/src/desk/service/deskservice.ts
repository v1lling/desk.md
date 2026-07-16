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
import type * as projectBriefApi from "../project-brief";
import type * as workspacesApi from "../workspaces";
import type * as meetingsApi from "../meetings";
import type * as personalApi from "../personal";
import type * as contentApi from "../content";
import type * as dashboardApi from "../dashboard";
import type * as viewStateApi from "../view-state";
import type * as settingsApi from "../settings";
import type * as agentQueriesApi from "../agent-queries";
import type * as catalogApi from "../catalog";
import type * as indexCacheApi from "../index-cache";
import type * as aiignoreApi from "../aiignore";
import type * as aiUsageApi from "../ai-usage";
import type * as maintenanceApi from "../maintenance";

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

  // ── Project brief + state (context/) ────────────────────────────────
  // The one definition of "which file is the brief" — shared by the Context panel and a
  // future entity-shaped MCP `desk_orient`. (The state file is written by the maintenance
  // engine in-process, never over RPC — see refreshProjectState below.)
  ensureProjectBrief: typeof projectBriefApi.ensureProjectBrief;

  // ── Content import / move ───────────────────────────────────────────
  createDocInFolder: typeof contentApi.createDocInFolder;
  importFiles: typeof contentApi.importFiles;
  moveDoc: typeof contentApi.moveDoc;

  // ── Dashboard / planner aggregators (cross-workspace reads) ─────────
  // Promoted to service methods so they run server-side in hosted mode (one
  // round-trip), instead of fanning out N+1 domain calls from the client.
  getFocusTasks: typeof dashboardApi.getFocusTasks;
  getWorkspaceSummaries: typeof dashboardApi.getWorkspaceSummaries;
  getAllWorkspaceTasksAllStatuses: typeof dashboardApi.getAllWorkspaceTasksAllStatuses;

  // ── View state (.view.json) — user-level, so it must route server-side in
  // hosted mode. Only the read + the read-modify-write mutators the stores use
  // are exposed (the read-modify-write happens in one round-trip server-side).
  getViewState: typeof viewStateApi.getViewState;
  updateTaskOrder: typeof viewStateApi.updateTaskOrder;
  removeTaskFromOrder: typeof viewStateApi.removeTaskFromOrder;
  setViewMode: typeof viewStateApi.setViewMode;
  setExpandedFolders: typeof viewStateApi.setExpandedFolders;
  toggleTaskHighlight: typeof viewStateApi.toggleTaskHighlight;
  setHiddenStatuses: typeof viewStateApi.setHiddenStatuses;

  // ── Shared settings KV (.desk/settings/*.json) — user-level settings that
  // follow the user across devices (templates, agent instructions, planner).
  getSetting: typeof settingsApi.getSetting;
  setSetting: typeof settingsApi.setSetting;

  // ── Assistant read tools (agent-queries) — the AI assistant's tree/read/search
  // layer. Promoted to the service so it runs server-side in hosted mode (one
  // round-trip; the server does the local-disk sweep) instead of hitting the
  // client's local disk. This is also the tool layer MCP wraps server-side.
  deskWorkspaceInfo: typeof agentQueriesApi.deskWorkspaceInfo;
  deskTree: typeof agentQueriesApi.deskTree;
  deskReadFile: typeof agentQueriesApi.deskReadFile;
  deskFullTextSearch: typeof agentQueriesApi.deskFullTextSearch;

  // ── Catalog (always-complete, AI-free metadata index) — promoted to the service so
  // a native-remote client builds the *server's* catalog in one round-trip, and the
  // MCP server builds it live (never empty). Summaries are merged on top separately.
  buildWorkspaceCatalog: typeof catalogApi.buildWorkspaceCatalog;

  // ── Smart Index cache (.desk/index/indexes.json) — DERIVED, but routed through
  // the service so the catalog follows the domain (server-side in hosted mode, where the
  // catalog tool / MCP read it). Read-only over the service: core is the sole writer, in-process
  // on the host that owns the data (maintenance engine + local rebuild), never over RPC.
  getIndexCache: typeof indexCacheApi.getIndexCache;

  // ── AI usage log (.desk/usage/ai-usage.json) — appended in-process by whichever
  // host runs the AI; the service only exposes the reads the Usage panel needs.
  getAIUsage: typeof aiUsageApi.getAIUsage;
  clearAIUsage: typeof aiUsageApi.clearAIUsage;

  // ── AI maintenance (runs where the data lives) — remote clients invoke the
  // SERVER's engine/keys through these; local mode resolves them in-process.
  refreshProjectState: typeof maintenanceApi.runStateRefreshNow;
  rebuildSmartIndex: typeof maintenanceApi.rebuildSmartIndex;
  removeFromSmartIndex: typeof maintenanceApi.removeIndexEntry;
  clearSmartIndex: typeof maintenanceApi.clearWorkspaceIndex;
  getAIMaintenanceInfo: typeof maintenanceApi.getAIMaintenanceInfo;

  // ── .aiignore management (per-workspace AI exclusions) — routed through the
  // service so the UI toggles + index reads operate on the *server's* .aiignore in
  // hosted mode. Enforcement itself lives in agent-queries (read side); these are
  // the read/write management ops. (isPathExcludedByAIIgnore stays a pure import.)
  setAIInclusion: typeof aiignoreApi.setAIInclusion;
  getAiExclusionState: typeof aiignoreApi.getAiExclusionState;
  getFolderAIInclusion: typeof aiignoreApi.getFolderAIInclusion;
  setFolderAIInclusion: typeof aiignoreApi.setFolderAIInclusion;
}
