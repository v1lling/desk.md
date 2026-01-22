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

/**
 * Get the Orbit data directory path
 * In Tauri: ~/Orbit (real path)
 * In browser: Returns mock path (data comes from mock arrays, not file system)
 */
export async function getOrbitPath(): Promise<string> {
  if (!isTauri()) {
    // Browser mode uses mock data from arrays, this path is only for display purposes
    return "~/Orbit";
  }

  const { homeDir, join } = await getTauriPathModule();
  const home = await homeDir();
  return await join(home, "Orbit");
}

/**
 * Check if a file or directory exists
 */
export async function exists(path: string): Promise<boolean> {
  if (!isTauri()) {
    console.log("[mock] exists:", path);
    return true; // Mock for browser
  }

  const fs = await getTauriFsModule();
  return fs.exists(path);
}

/**
 * Read a text file
 */
export async function readTextFile(path: string): Promise<string> {
  if (!isTauri()) {
    console.log("[mock] readTextFile:", path);
    throw new Error("File system not available in browser mode");
  }

  const fs = await getTauriFsModule();
  return fs.readTextFile(path);
}

/**
 * Write a text file
 */
export async function writeTextFile(path: string, content: string): Promise<void> {
  if (!isTauri()) {
    console.log("[mock] writeTextFile:", path, content.substring(0, 100) + "...");
    return;
  }

  const fs = await getTauriFsModule();
  await fs.writeTextFile(path, content);
}

/**
 * Create a directory (recursively)
 */
export async function mkdir(path: string): Promise<void> {
  if (!isTauri()) {
    console.log("[mock] mkdir:", path);
    return;
  }

  const fs = await getTauriFsModule();
  await fs.mkdir(path, { recursive: true });
}

/**
 * Remove a file
 */
export async function removeFile(path: string): Promise<void> {
  if (!isTauri()) {
    console.log("[mock] removeFile:", path);
    return;
  }

  const fs = await getTauriFsModule();
  await fs.remove(path);
}

/**
 * Remove a directory (recursively)
 */
export async function removeDir(path: string): Promise<void> {
  if (!isTauri()) {
    console.log("[mock] removeDir:", path);
    return;
  }

  const fs = await getTauriFsModule();
  await fs.remove(path, { recursive: true });
}

/**
 * Rename/move a file or directory
 */
export async function rename(oldPath: string, newPath: string): Promise<void> {
  if (!isTauri()) {
    console.log("[mock] rename:", oldPath, "->", newPath);
    return;
  }

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
    console.log("[mock] readDir:", path);
    return [];
  }

  const fs = await getTauriFsModule();
  const entries = await fs.readDir(path);
  return entries.map(entry => ({
    name: entry.name,
    isDirectory: entry.isDirectory,
    isFile: entry.isFile,
  }));
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
 * Initialize the Orbit directory structure
 */
export async function initOrbitDirectory(): Promise<void> {
  const orbitPath = await getOrbitPath();

  // Create base directory
  await mkdir(orbitPath);

  // Create workspaces directory
  const workspacesPath = await joinPath(orbitPath, PATH_SEGMENTS.WORKSPACES);
  await mkdir(workspacesPath);

  // Create personal directory structure
  const personalPath = await joinPath(orbitPath, PATH_SEGMENTS.PERSONAL);
  await mkdir(personalPath);
  await mkdir(await joinPath(personalPath, PATH_SEGMENTS.INBOX));
  await mkdir(await joinPath(personalPath, PATH_SEGMENTS.INBOX, PATH_SEGMENTS.TASKS));
  await mkdir(await joinPath(personalPath, PATH_SEGMENTS.TASKS));
  await mkdir(await joinPath(personalPath, PATH_SEGMENTS.DOCS));

  // Create config if it doesn't exist
  const configPath = await joinPath(orbitPath, "config.json");
  if (!(await exists(configPath))) {
    const defaultConfig = {
      currentWorkspaceId: null,
      theme: "system",
      sidebarCollapsed: false,
      setupCompleted: false,
    };
    await writeTextFile(configPath, JSON.stringify(defaultConfig, null, 2));
  }
}

/**
 * Read the Orbit config file
 */
export async function readConfig(): Promise<Record<string, unknown>> {
  const orbitPath = await getOrbitPath();
  const configPath = await joinPath(orbitPath, "config.json");

  try {
    const content = await readTextFile(configPath);
    return JSON.parse(content);
  } catch {
    return {
      currentWorkspaceId: null,
      theme: "system",
      sidebarCollapsed: false,
      setupCompleted: false,
    };
  }
}

/**
 * Write the Orbit config file
 */
export async function writeConfig(config: Record<string, unknown>): Promise<void> {
  const orbitPath = await getOrbitPath();
  const configPath = await joinPath(orbitPath, "config.json");
  await writeTextFile(configPath, JSON.stringify(config, null, 2));
}
