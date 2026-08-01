/** The app's only adapter for maintenance operations owned by the local data host. */
import {
  notifyExternalChanges,
  readWorkspaceIndex,
  rebuildWorkspaceIndex,
  startMaintenanceEngine,
  writeRebuiltWorkspaceIndex,
} from "@desk/core/host/maintenance";
import type { WorkspaceIndex } from "@desk/core";

export const startLocalMaintenanceEngine = startMaintenanceEngine;

export function notifyLocalMaintenanceOfExternalChanges(
  paths: string[],
  kind: "modify" | "remove",
): void {
  notifyExternalChanges(paths, kind);
}

export function readLocalWorkspaceIndex(workspaceId: string) {
  return readWorkspaceIndex(workspaceId);
}

export function rebuildLocalWorkspaceIndex(
  ...args: Parameters<typeof rebuildWorkspaceIndex>
) {
  return rebuildWorkspaceIndex(...args);
}

export function writeRebuiltLocalWorkspaceIndex(
  index: WorkspaceIndex,
  previous: WorkspaceIndex | undefined,
) {
  return writeRebuiltWorkspaceIndex(index, previous);
}
