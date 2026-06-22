/**
 * Environment helpers: data-root resolution, path joining, and bootstrap.
 *
 * These are NOT filesystem I/O (that's StorageProvider in ./storage) — they
 * resolve the configured data path and Tauri fs scope for the current runtime.
 * Re-exports the pure platform checks so callers have a single import surface.
 */
import { PATH_SEGMENTS } from "./constants";
import { isTauri } from "./platform";
import { getStorage } from "./storage";

export { isTauri, isMacOS, needsTrafficLightPadding } from "./platform";

async function getTauriPathModule() {
  const { homeDir, join } = await import("@tauri-apps/api/path");
  return { homeDir, join };
}

/**
 * Get the Desk data directory path.
 * Reads from the boot store, falls back to ~/Desk.
 * In Tauri: resolves ~ to the actual home directory.
 * In browser: returns the configured path (data comes from mock arrays).
 */
export async function getDeskPath(): Promise<string> {
  // Import the boot store dynamically to avoid circular dependencies
  const { useBootStore } = await import("@/stores/boot");
  const dataPath = useBootStore.getState().dataPath || "~/Desk";

  if (!isTauri()) {
    // Browser mode uses mock data from arrays; this path is for display only
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
 * Join path segments.
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
  const storage = getStorage();
  const deskPath = await getDeskPath();

  // Create base directory
  await storage.mkdir(deskPath);

  // Create workspaces directory
  const workspacesPath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES);
  await storage.mkdir(workspacesPath);
}
