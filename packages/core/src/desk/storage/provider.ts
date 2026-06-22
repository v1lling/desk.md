/**
 * StorageProvider — the single filesystem seam for the desk.md domain layer.
 *
 * Everything in @desk/core (parser, CRUD, file-cache, search) reaches the
 * filesystem exclusively through this interface. Today it is backed by Tauri
 * (TauriProvider) on the desktop and a no-op BrowserProvider in browser/mock
 * mode. @desk/server runs the same domain layer against a NodeFsProvider (and a
 * future S3Provider) by calling setStorage() at boot — no domain code changes.
 *
 * Scope: the 10 raw I/O primitives only. Environment/path helpers (isTauri,
 * getDeskPath, joinPath, …) are NOT storage I/O and live in ../env.
 */

export interface DirEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface FileStat {
  birthtime: Date | null; // File creation time
  mtime: Date | null; // File modification time
  size: number;
}

export interface StorageProvider {
  /**
   * True only for the no-real-filesystem browser/dev provider. The domain reads
   * seed/mock data instead of hitting storage when this is set (see isMockMode
   * in ../env). Tauri and Node providers leave it unset/false.
   */
  readonly isMock?: boolean;
  /** Check if a file or directory exists. */
  exists(path: string): Promise<boolean>;
  /** Read a UTF-8 text file. */
  readTextFile(path: string): Promise<string>;
  /** Write a UTF-8 text file. */
  writeTextFile(path: string, content: string): Promise<void>;
  /** Write a binary file. */
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  /** Create a directory (recursively). */
  mkdir(path: string): Promise<void>;
  /** Remove a single file. */
  removeFile(path: string): Promise<void>;
  /** Remove a directory (recursively). */
  removeDir(path: string): Promise<void>;
  /** Rename/move a file or directory. */
  rename(oldPath: string, newPath: string): Promise<void>;
  /** List a directory's immediate entries. */
  readDir(path: string): Promise<DirEntry[]>;
  /** Get file metadata, or null if it does not exist / cannot be stat'd. */
  fileStat(path: string): Promise<FileStat | null>;
}
