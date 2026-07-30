/**
 * Storage registry — resolves the active StorageProvider.
 *
 * Defaults to TauriProvider on the desktop and BrowserProvider in browser
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
export { InMemoryStorageProvider } from "./memory-provider";
export type { MemorySeedFile } from "./memory-provider";

let activeProvider: StorageProvider | null = null;

/** Override the active provider (used by the server to inject NodeFsProvider). */
export function setStorage(provider: StorageProvider): void {
  activeProvider = provider;
}

/** Restore lazy environment selection. Primarily used by isolated test runtimes. */
export function resetStorage(): void {
  activeProvider = null;
}

/** Get the active StorageProvider, lazily creating the environment default. */
export function getStorage(): StorageProvider {
  if (!activeProvider) {
    activeProvider = isTauri() ? new TauriProvider() : new BrowserProvider();
  }
  return activeProvider;
}
