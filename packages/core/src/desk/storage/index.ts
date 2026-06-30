/**
 * Storage registry — resolves the active StorageProvider.
 *
 * Defaults to TauriProvider on the desktop and BrowserProvider in browser/mock
 * mode, chosen once via isTauri(). A future server calls setStorage() at boot
 * to inject a NodeFsProvider / S3Provider; the entire domain layer then runs
 * unchanged against the remote backend.
 */
import { isTauri } from "../platform";
import { BrowserProvider } from "./browser-provider";
import type { StorageProvider } from "./provider";
import { TauriProvider } from "./tauri-provider";

export type { DirEntry, FileStat, StorageProvider } from "./provider";
export { GuardStorageProvider } from "./guard-provider";

let activeProvider: StorageProvider | null = null;

/** Override the active provider (used by the server to inject NodeFsProvider). */
export function setStorage(provider: StorageProvider): void {
  activeProvider = provider;
}

/** Get the active StorageProvider, lazily creating the environment default. */
export function getStorage(): StorageProvider {
  if (!activeProvider) {
    activeProvider = isTauri() ? new TauriProvider() : new BrowserProvider();
  }
  return activeProvider;
}
