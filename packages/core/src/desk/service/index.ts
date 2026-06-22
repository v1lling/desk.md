/**
 * DeskService registry — resolves the active SEAM 2 implementation.
 *
 * Defaults to LocalDeskService (the domain running in-process; see
 * local-deskservice.ts). A future web / native-hosted client or server calls
 * setDeskService() at boot to inject a RemoteDeskService, after which every
 * external caller that goes through getDeskService() targets the remote backend
 * with no further changes.
 *
 * Mirrors the StorageProvider registry in ../storage. External code (the app's
 * stores, components, hooks) MUST reach domain operations through
 * getDeskService(); code inside @desk/core keeps calling the domain functions
 * directly.
 */
import type { DeskService } from "./deskservice";
import { localDeskService } from "./local-deskservice";

export type { DeskService } from "./deskservice";

let activeService: DeskService = localDeskService;

/** Override the active service (used by the web/native-hosted client + server). */
export function setDeskService(service: DeskService): void {
  activeService = service;
}

/** Get the active DeskService. */
export function getDeskService(): DeskService {
  return activeService;
}
