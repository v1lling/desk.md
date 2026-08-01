/**
 * Public @desk/core domain surface.
 *
 * Application I/O goes through DeskService. This barrel intentionally contains
 * only the service contract, domain types, errors, constants, and pure helpers.
 * Runtime wiring and local-owner filesystem/maintenance operations live at
 * @desk/core/host.
 */

// Domain service and RPC transport codec.
export { getDeskService, encode, decode } from "./service";
export type { DeskService } from "./service";

// Supported environment and path helpers. Filesystem scope/bootstrap are host-owned.
export { isTauri, isMacOS, needsTrafficLightPadding, getDeskPath, joinPath } from "./env";
export * from "./parser";
export * from "./frontmatter";
export * from "./constants";
export * from "./paths";
export * from "./tree-path";
export * from "./file-utils";
export * from "./note-link";
export * from "./norms";
export * from "./agent-instructions";
export type {
  AgentEntryType,
  AgentAuthor,
  AgentCatalogEntry,
  AgentCatalogQuery,
  AgentCatalogResult,
  AgentSearchQuery,
  AgentSearchResult,
  AgentContextQuery,
  AgentContextResult,
  AgentReadQuery,
  AgentReadResult,
  AgentReadErrorCode,
} from "./agent-read";
export { AgentReadError, asSafeAgentReadError } from "./agent-read";

// Pure document-tree, overview, and planner helpers.
export * from "./content-tree-utils";
export * from "./overview";
export * from "./planner";
export type { DocLocation, ConvertibleAction, ImportFilesResult } from "./content";

// Catalog and Smart Index data contracts.
export type {
  CatalogEntry,
  IndexEntry,
  WorkspaceCatalog,
  WorkspaceIndex,
} from "./catalog/types";
export {
  getSummaryPreviewLength,
  SUMMARY_BATCH_SIZE,
} from "./maintenance/types";
export type {
  SummaryDetail,
  BuildIndexProgress,
  BuildIndexResult,
} from "./maintenance/types";
export { AI_MAINTENANCE_DEFAULTS } from "./maintenance/config";
export type { AIMaintenanceSettings } from "./maintenance/config";

// Runtime-agnostic AI API and typed provider errors.
export * from "./ai";

// In-memory search and scoped identity helpers.
export * from "./search-index";
export * from "./path-identity";
export * from "./entity-identity";

// Computed result shapes; their storage-backed operations are DeskService methods.
export type {
  ActiveTask,
  DashboardOverview,
  DashboardOverviewOptions,
  DashboardTaskItem,
  RecentWorkItem,
  RecentWorkKind,
} from "./dashboard";
export { sortTasksByOrder } from "./view-state";
export type { AiExclusionState } from "./aiignore";

// App-local editor synchronization does not perform persistence itself.
export {
  subscribeToEditorEvents,
  publishContentUpdate,
  publishPathChange,
  publishDeleted,
} from "./editor-event-bus";
export type { EditorEventHandlers } from "./editor-event-bus";

// The app watcher shares this event shape, while cache ownership stays host-only.
export type { FileChangeEvent } from "./file-cache";
