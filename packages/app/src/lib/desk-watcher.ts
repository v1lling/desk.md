/**
 * File System Watcher Service
 *
 * Watches the Desk directory for changes and notifies listeners.
 * Used to keep the UI in sync when files are modified externally.
 */

import { toast } from "sonner";
import { isTauri, getDeskPath, getStorage } from "@desk/core";
import { isRemoteMode } from "@/lib/connection";

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
 * Normalize a path to forward slashes so substring and regex checks work
 * consistently across platforms (Tauri returns `\` separators on Windows).
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

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
 * Start watching the Desk directory
 * Safe to call multiple times - will only start once
 */
function handleWatchEvent(event: unknown) {
  const parsed = parseWatchEvent(event);
  if (!parsed) return;

  const filteredPaths = parsed.paths.filter(p => {
    const np = normalizePath(p);
    return (
      !np.includes(".DS_Store") &&
      !np.includes("/.git/") &&
      !np.includes("/.desk/") &&
      !np.endsWith(".view.json")
    );
  });

  if (filteredPaths.length > 0) {
    queueEvent({ ...parsed, paths: filteredPaths });
  }
}

async function attachWatcher(): Promise<void> {
  const fs = await import("@tauri-apps/plugin-fs");
  const deskPath = await getDeskPath();
  unwatchFn = await fs.watch(deskPath, handleWatchEvent, { recursive: true });
}

export async function startWatching(): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }

  // In remote mode the data lives on the server; getDeskPath() still resolves to the
  // local ~/DeskMD, so watching it would only fire spurious invalidations unrelated to
  // the server's files. Live remote sync is separate, future work.
  if (isRemoteMode()) {
    return false;
  }

  if (isWatching) {
    return true;
  }

  // On very first launch the Desk directory may not exist yet — retrying
  // won't help, and toasting "watcher stopped" would just be noise.
  const deskPath = await getDeskPath();
  if (!(await getStorage().exists(deskPath))) {
    return false;
  }

  try {
    await attachWatcher();
    isWatching = true;
    return true;
  } catch (err) {
    console.error("[watcher] Failed to start file watcher (attempt 1):", err);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      await attachWatcher();
      isWatching = true;
      return true;
    } catch (retryErr) {
      console.error("[watcher] File watcher failed after retry:", retryErr);
      toast.error("File watcher stopped. External edits won't sync until you restart Desk.");
      return false;
    }
  }
}

/**
 * Stop watching the Desk directory
 */
export async function stopWatching(): Promise<void> {
  if (!isWatching || !unwatchFn) {
    return;
  }

  try {
    unwatchFn();
    unwatchFn = null;
    isWatching = false;
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

