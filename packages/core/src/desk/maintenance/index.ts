export * from "./types";
export * from "./config";
export {
  readWorkspaceIndex,
  writeWorkspaceIndex,
  writeRebuiltWorkspaceIndex,
  upsertIndexEntry,
  removeIndexEntry,
  removeIndexEntries,
  clearWorkspaceIndex,
} from "./index-store-io";
export { updateIndexForFile, removeFileFromIndex } from "./index-updater";
export { performStateRefresh, type StateRefreshResult } from "./state-refresher";
export { rebuildWorkspaceIndex, rebuildSmartIndex } from "./rebuild";
export {
  startMaintenanceEngine,
  notifyExternalChanges,
  runStateRefreshNow,
  getAIMaintenanceInfo,
  type MaintenanceEngineOptions,
  type AIMaintenanceInfo,
} from "./scheduler";
