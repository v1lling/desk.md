/**
 * BrowserProvider — StorageProvider for browser/mock mode (no real filesystem).
 *
 * Preserves the exact behavior the old tauri-fs.ts free functions had when
 * isTauri() was false: existence is assumed, reads throw, writes are no-ops,
 * listings are empty. In practice the domain layer short-circuits to mock-data
 * arrays before most of these are hit; this is the safety net for anything that
 * does reach storage.
 */
import type { DirEntry, FileStat, StorageProvider } from "./provider";

export class BrowserProvider implements StorageProvider {
  async exists(): Promise<boolean> {
    return true; // Mock for browser
  }

  async readTextFile(): Promise<string> {
    throw new Error("File system not available in browser mode");
  }

  async writeTextFile(): Promise<void> {
    // no-op
  }

  async writeFile(): Promise<void> {
    // no-op
  }

  async mkdir(): Promise<void> {
    // no-op
  }

  async removeFile(): Promise<void> {
    // no-op
  }

  async removeDir(): Promise<void> {
    // no-op
  }

  async rename(): Promise<void> {
    // no-op
  }

  async readDir(): Promise<DirEntry[]> {
    return [];
  }

  async fileStat(): Promise<FileStat | null> {
    return null;
  }
}
