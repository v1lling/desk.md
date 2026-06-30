/**
 * Connection-mode helpers (step 3b-native).
 *
 * `isRemoteMode()` is true when the native app is pointed at a remote desk.md server
 * rather than local disk. Local-disk-only affordances (reveal in Finder, open in
 * Terminal, open-with-default-app, the data-folder editor) don't apply then — the files
 * live on the server, not this Mac — so they guard on this.
 */
import { isTauri } from "@desk/core";
import { useBootStore } from "@/stores/boot";

export function isRemoteMode(): boolean {
  return useBootStore.getState().connectionMode === "remote";
}

/**
 * True when the domain runs on a server, i.e. `getDeskService()` is a RemoteDeskService:
 * the native app pointed at a server (`connectionMode === "remote"`) OR the hosted web
 * build (`VITE_DESK_HOSTED`). The distinction from `isRemoteMode()` is the hosted-web case.
 */
export function isDomainRemote(): boolean {
  return isRemoteMode() || Boolean(import.meta.env.VITE_DESK_HOSTED);
}

/**
 * The ONLY condition under which client code may touch `getStorage()` directly: a Tauri
 * app whose domain runs locally. In every other posture (native-remote, hosted web,
 * browser-mock) domain data must go through `getDeskService()`; in the remote postures a
 * GuardStorageProvider makes a stray `getStorage()` throw instead of hitting the wrong disk.
 */
export function isLocalDisk(): boolean {
  return isTauri() && !isDomainRemote();
}
