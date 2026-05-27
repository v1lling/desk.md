/**
 * Tauri File System wrapper
 * Provides a unified API that works in both Tauri and browser environments
 */
import { PATH_SEGMENTS } from "./constants";

// Check if running in Tauri
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;

  // Check for __TAURI_INTERNALS__ which is the Tauri 2.x way
  if ("__TAURI_INTERNALS__" in window) return true;

  // Fallback to __TAURI__ for compatibility
  if ("__TAURI__" in window) return true;

  return false;
}

// Check if running on macOS (for title bar styling)
export function isMacOS(): boolean {
  if (typeof window === "undefined") return false;
  return navigator.userAgent.includes("Mac");
}

// Check if we need traffic light padding (macOS + Tauri with overlay title bar)
export function needsTrafficLightPadding(): boolean {
  return isTauri() && isMacOS();
}

// Lazy import Tauri modules only when needed
async function getTauriFsModule() {
  const fs = await import("@tauri-apps/plugin-fs");
  return fs;
}

async function getTauriPathModule() {
  const { homeDir, join } = await import("@tauri-apps/api/path");
  return { homeDir, join };
}

// Paths already granted via allow_data_path — skip repeat invokes.
const allowedHiddenPaths = new Set<string>();

/**
 * Ensure a hidden (dot-prefixed) path is allowed by the Tauri fs scope.
 *
 * The fs capabilities defer to the runtime global scope, which on macOS/Linux
 * cannot glob-match path components starting with "." (the `dataDir/**` entry from
 * expandFsScope() excludes them). Before any fs op on a path with a hidden segment,
 * we ask the backend for a literal allow entry, which does match dotfiles. The
 * backend rejects anything outside the data root — that containment check is the
 * security boundary. No-ops in browser mode and for non-hidden paths.
 */
async function ensureHiddenPathAllowed(path: string): Promise<void> {
  if (!isTauri()) return;
  if (!path.includes("/.")) return; // fast check: no hidden segment
  if (allowedHiddenPaths.has(path)) return; // cache hit

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("allow_data_path", { path });
    allowedHiddenPaths.add(path);
  } catch (err) {
    console.error("[tauri-fs] allow_data_path failed for", path, err);
    // Continue — the fs call below will surface a clearer error if still denied.
  }
}

/**
 * Get the Desk data directory path
 * Reads from settings store, falls back to ~/Desk
 * In Tauri: Resolves ~ to actual home directory
 * In browser: Returns mock path (data comes from mock arrays, not file system)
 */
export async function getDeskPath(): Promise<string> {
  // Import settings store dynamically to avoid circular dependencies
  const { useBootStore } = await import("@/stores/boot");
  const dataPath = useBootStore.getState().dataPath || "~/Desk";

  if (!isTauri()) {
    // Browser mode uses mock data from arrays, this path is only for display purposes
    return dataPath;
  }

  // Expand ~ to home directory if needed
  if (dataPath.startsWith("~/") || dataPath === "~") {
    const { homeDir, join } = await getTauriPathModule();
    const home = await homeDir();
    const relativePath = dataPath.slice(2) || ""; // Remove ~/
    return relativePath ? await join(home, relativePath) : home;
  }

  return dataPath;
}

// Alias for backwards compatibility during migration
export const getOrbitPath = getDeskPath;

/**
 * Expand the Tauri file system scope to allow access to a directory.
 * Must be called before any FS operations on the user's data path.
 * No-ops in browser mode.
 */
export async function expandFsScope(dataPath?: string): Promise<void> {
  if (!isTauri()) return;

  const path = dataPath || (await getDeskPath());

  // Resolve ~ to absolute path
  let resolvedPath = path;
  if (path.startsWith("~/") || path === "~") {
    const { homeDir, join } = await getTauriPathModule();
    const home = await homeDir();
    const relativePath = path.slice(2) || "";
    resolvedPath = relativePath ? await join(home, relativePath) : home;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("expand_fs_scope", { path: resolvedPath });
}

/**
 * Check if a file or directory exists
 */
export async function exists(path: string): Promise<boolean> {
  if (!isTauri()) {
    return true; // Mock for browser
  }

  await ensureHiddenPathAllowed(path);
  const fs = await getTauriFsModule();
  return fs.exists(path);
}

/**
 * Read a text file
 */
export async function readTextFile(path: string): Promise<string> {
  if (!isTauri()) {
    throw new Error("File system not available in browser mode");
  }

  await ensureHiddenPathAllowed(path);
  const fs = await getTauriFsModule();
  return fs.readTextFile(path);
}

/**
 * Write a text file
 */
export async function writeTextFile(path: string, content: string): Promise<void> {
  if (!isTauri()) {
    return;
  }

  await ensureHiddenPathAllowed(path);
  const fs = await getTauriFsModule();
  await fs.writeTextFile(path, content);
}

/**
 * Write a binary file
 */
export async function writeFile(path: string, bytes: Uint8Array): Promise<void> {
  if (!isTauri()) {
    return;
  }

  await ensureHiddenPathAllowed(path);
  const fs = await getTauriFsModule();
  await fs.writeFile(path, bytes);
}

/**
 * Create a directory (recursively)
 */
export async function mkdir(path: string): Promise<void> {
  if (!isTauri()) {
    return;
  }

  await ensureHiddenPathAllowed(path);
  const fs = await getTauriFsModule();
  await fs.mkdir(path, { recursive: true });
}

/**
 * Remove a file
 */
export async function removeFile(path: string): Promise<void> {
  if (!isTauri()) {
    return;
  }

  await ensureHiddenPathAllowed(path);
  const fs = await getTauriFsModule();
  await fs.remove(path);
}

/**
 * Remove a directory (recursively)
 */
export async function removeDir(path: string): Promise<void> {
  if (!isTauri()) {
    return;
  }

  await ensureHiddenPathAllowed(path);
  const fs = await getTauriFsModule();
  await fs.remove(path, { recursive: true });
}

/**
 * Rename/move a file or directory
 */
export async function rename(oldPath: string, newPath: string): Promise<void> {
  if (!isTauri()) {
    return;
  }

  await ensureHiddenPathAllowed(oldPath);
  await ensureHiddenPathAllowed(newPath);
  const fs = await getTauriFsModule();
  await fs.rename(oldPath, newPath);
}

export interface DirEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

/**
 * Read a directory
 */
export async function readDir(path: string): Promise<DirEntry[]> {
  if (!isTauri()) {
    return [];
  }

  await ensureHiddenPathAllowed(path);
  const fs = await getTauriFsModule();
  const entries = await fs.readDir(path);
  return entries.map(entry => ({
    name: entry.name,
    isDirectory: entry.isDirectory,
    isFile: entry.isFile,
  }));
}

export interface FileStat {
  birthtime: Date | null;  // File creation time
  mtime: Date | null;      // File modification time
  size: number;
}

/**
 * Get file metadata (creation time, modification time, size)
 */
export async function fileStat(path: string): Promise<FileStat | null> {
  if (!isTauri()) return null;

  try {
    await ensureHiddenPathAllowed(path);
    const fs = await getTauriFsModule();
    const info = await fs.stat(path);
    return {
      birthtime: info.birthtime,
      mtime: info.mtime,
      size: info.size,
    };
  } catch {
    return null;
  }
}

/**
 * Join path segments
 */
export async function joinPath(...segments: string[]): Promise<string> {
  if (!isTauri()) {
    return segments.join("/");
  }

  const { join } = await getTauriPathModule();
  let result = segments[0];
  for (let i = 1; i < segments.length; i++) {
    result = await join(result, segments[i]);
  }
  return result;
}

/**
 * Initialize the Desk directory structure.
 * Only ensures ~/Desk/ and ~/Desk/workspaces/ exist — the home workspace is
 * created during onboarding via createWorkspace({ home: true }).
 */
export async function initDeskDirectory(): Promise<void> {
  const deskPath = await getDeskPath();

  // Create base directory
  await mkdir(deskPath);

  // Create workspaces directory
  const workspacesPath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES);
  await mkdir(workspacesPath);
}
