/**
 * File System Watcher Service
 *
 * Watches the Orbit directory for changes and notifies listeners.
 * Used to keep the UI in sync when files are modified externally.
 */

import { isTauri, getOrbitPath } from "./tauri-fs";

// Event types we care about
export type WatchEventKind = "create" | "modify" | "remove" | "any";

export interface WatchEvent {
  kind: WatchEventKind;
  paths: string[];
}

export type WatchCallback = (event: WatchEvent) => void;

// Singleton state
let unwatchFn: (() => void) | null = null;
let isWatching = false;
const listeners = new Set<WatchCallback>();

// Debounce state - collect events and batch them
let pendingEvents: WatchEvent[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 150;

/**
 * Parse Tauri watch event into our simplified format
 */
function parseWatchEvent(event: unknown): WatchEvent | null {
  // Tauri fs watch events have this structure:
  // { type: { create?: {...}, modify?: {...}, remove?: {...} }, paths: string[], attrs: {...} }
  const e = event as { type?: Record<string, unknown>; paths?: string[] };

  if (!e.paths || e.paths.length === 0) return null;

  let kind: WatchEventKind = "any";

  if (e.type) {
    if ("create" in e.type || "Create" in e.type) kind = "create";
    else if ("modify" in e.type || "Modify" in e.type) kind = "modify";
    else if ("remove" in e.type || "Remove" in e.type) kind = "remove";
  }

  return { kind, paths: e.paths };
}

/**
 * Flush pending events to listeners
 */
function flushEvents() {
  if (pendingEvents.length === 0) return;

  // Merge events - dedupe paths and determine overall kind
  const allPaths = new Set<string>();
  let hasCreate = false;
  let hasModify = false;
  let hasRemove = false;

  for (const event of pendingEvents) {
    event.paths.forEach(p => allPaths.add(p));
    if (event.kind === "create") hasCreate = true;
    if (event.kind === "modify") hasModify = true;
    if (event.kind === "remove") hasRemove = true;
  }

  // Determine merged kind (or "any" if mixed)
  let mergedKind: WatchEventKind = "any";
  const kindCount = [hasCreate, hasModify, hasRemove].filter(Boolean).length;
  if (kindCount === 1) {
    if (hasCreate) mergedKind = "create";
    else if (hasModify) mergedKind = "modify";
    else if (hasRemove) mergedKind = "remove";
  }

  const mergedEvent: WatchEvent = {
    kind: mergedKind,
    paths: Array.from(allPaths),
  };

  // Notify all listeners
  listeners.forEach(callback => {
    try {
      callback(mergedEvent);
    } catch (err) {
      console.error("[watcher] Listener error:", err);
    }
  });

  pendingEvents = [];
  debounceTimer = null;
}

/**
 * Queue an event for debounced delivery
 */
function queueEvent(event: WatchEvent) {
  pendingEvents.push(event);

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(flushEvents, DEBOUNCE_MS);
}

/**
 * Start watching the Orbit directory
 * Safe to call multiple times - will only start once
 */
export async function startWatching(): Promise<boolean> {
  if (!isTauri()) {
    console.log("[watcher] Not in Tauri mode, skipping file watcher");
    return false;
  }

  if (isWatching) {
    console.log("[watcher] Already watching");
    return true;
  }

  try {
    const fs = await import("@tauri-apps/plugin-fs");
    const orbitPath = await getOrbitPath();

    console.log("[watcher] Starting to watch:", orbitPath);

    unwatchFn = await fs.watch(
      orbitPath,
      (event) => {
        const parsed = parseWatchEvent(event);
        if (parsed) {
          // Filter out .DS_Store and other system files
          const filteredPaths = parsed.paths.filter(p =>
            !p.includes(".DS_Store") &&
            !p.includes(".git")
          );

          if (filteredPaths.length > 0) {
            queueEvent({ ...parsed, paths: filteredPaths });
          }
        }
      },
      { recursive: true }
    );

    isWatching = true;
    console.log("[watcher] File watcher started successfully");
    return true;
  } catch (err) {
    console.error("[watcher] Failed to start file watcher:", err);
    return false;
  }
}

/**
 * Stop watching the Orbit directory
 */
export async function stopWatching(): Promise<void> {
  if (!isWatching || !unwatchFn) {
    return;
  }

  try {
    unwatchFn();
    unwatchFn = null;
    isWatching = false;
    console.log("[watcher] File watcher stopped");
  } catch (err) {
    console.error("[watcher] Failed to stop file watcher:", err);
  }
}

/**
 * Subscribe to watch events
 * Returns an unsubscribe function
 */
export function onFileChange(callback: WatchCallback): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Check if watcher is active
 */
export function isWatcherActive(): boolean {
  return isWatching;
}

/**
 * Utility: Extract item type from path
 * e.g., "/Users/x/Orbit/workspaces/foo/projects/bar/tasks/baz.md" → "task"
 */
export function getItemTypeFromPath(path: string): "task" | "note" | "meeting" | "project" | "workspace" | "config" | "view" | "unknown" {
  if (path.endsWith(".view.json")) return "view";
  if (path.endsWith("config.json")) return "config";
  if (path.includes("/tasks/")) return "task";
  if (path.includes("/notes/")) return "note";
  if (path.includes("/meetings/")) return "meeting";
  if (path.includes("/projects/") && path.endsWith("project.md")) return "project";
  if (path.includes("/workspaces/") && path.endsWith("workspace.md")) return "workspace";
  return "unknown";
}

/**
 * Utility: Extract workspace ID from path
 * e.g., "/Users/x/Orbit/workspaces/my-workspace/..." → "my-workspace"
 */
export function getWorkspaceIdFromPath(path: string): string | null {
  const match = path.match(/\/workspaces\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Utility: Extract project ID from path
 * e.g., "/Users/x/Orbit/workspaces/foo/projects/my-project/..." → "my-project"
 */
export function getProjectIdFromPath(path: string): string | null {
  const match = path.match(/\/projects\/([^/]+)/);
  return match ? match[1] : null;
}
