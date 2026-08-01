/** Maintenance lifecycle and persistence for the process that owns the data. */
export {
  startMaintenanceEngine,
  notifyExternalChanges,
  readWorkspaceIndex,
  rebuildWorkspaceIndex,
  writeRebuiltWorkspaceIndex,
} from "../desk/maintenance";
