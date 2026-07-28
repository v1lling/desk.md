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
export { updateIndexForFile } from "./index-updater";
export { rebuildWorkspaceIndex, rebuildSmartIndex } from "./rebuild";
export {
  startMaintenanceEngine,
  notifyExternalChanges,
  getAIMaintenanceInfo,
  type MaintenanceEngineOptions,
  type AIMaintenanceInfo,
} from "./scheduler";
