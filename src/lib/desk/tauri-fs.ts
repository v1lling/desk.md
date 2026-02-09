/**
 * Tauri File System wrapper
 * Provides a unified API that works in both Tauri and browser environments
 */
import { PATH_SEGMENTS, SPECIAL_DIRS } from "./constants";

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
 * Get the Desk data directory path
 * Reads from settings store, falls back to ~/Desk
 * In Tauri: Resolves ~ to actual home directory
 * In browser: Returns mock path (data comes from mock arrays, not file system)
 */
export async function getDeskPath(): Promise<string> {
  // Import settings store dynamically to avoid circular dependencies
  const { useSettingsStore } = await import("@/stores/settings");
  const dataPath = useSettingsStore.getState().dataPath || "~/Desk";

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
 * Initialize the Desk directory structure
 * Personal workspace is created under workspaces/_personal/
 */
export async function initDeskDirectory(): Promise<void> {
  const deskPath = await getDeskPath();

  // Create base directory
  await mkdir(deskPath);

  // Create workspaces directory
  const workspacesPath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES);
  await mkdir(workspacesPath);

  // Create Personal workspace structure (Personal is a workspace now)
  const personalPath = await joinPath(workspacesPath, SPECIAL_DIRS.PERSONAL);
  await mkdir(personalPath);
  await mkdir(await joinPath(personalPath, PATH_SEGMENTS.PROJECTS));
  await mkdir(await joinPath(personalPath, PATH_SEGMENTS.DOCS));

  // Personal unassigned area
  await mkdir(await joinPath(personalPath, SPECIAL_DIRS.UNASSIGNED));
  await mkdir(await joinPath(personalPath, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.TASKS));
  await mkdir(await joinPath(personalPath, SPECIAL_DIRS.UNASSIGNED, PATH_SEGMENTS.DOCS));

  // Personal capture area (for quick triage)
  await mkdir(await joinPath(personalPath, SPECIAL_DIRS.CAPTURE));
  await mkdir(await joinPath(personalPath, SPECIAL_DIRS.CAPTURE, PATH_SEGMENTS.TASKS));

  // Create Personal workspace.md if it doesn't exist
  const personalWorkspacePath = await joinPath(personalPath, "workspace.md");
  if (!(await exists(personalWorkspacePath))) {
    const personalContent = `---
name: Personal
description: Private tasks, docs, and projects
color: "#6366f1"
created: 2024-01-01
---

# Personal

Private tasks, docs, and projects.
`;
    await writeTextFile(personalWorkspacePath, personalContent);
  }

}

// Alias for backwards compatibility during migration
export const initOrbitDirectory = initDeskDirectory;
