/**
 * Watcher Integration
 *
 * Connects the file system watcher to the file tree service.
 * Handles cache invalidation and subscriber notifications on file changes.
 */

import { onFileChange, type WatchEvent } from "./desk-watcher";
import { getFileTreeService, getContentCache, type FileChangeEvent } from "@desk/core";

// Track if we're connected to the watcher
let isConnected = false;
let unsubscribe: (() => void) | null = null;

/**
 * Convert watcher event kind to file-tree event type
 */
function mapEventKind(kind: WatchEvent["kind"]): FileChangeEvent["type"] {
  switch (kind) {
    case "create":
      return "create";
    case "modify":
      return "modify";
    case "remove":
      return "delete";
    default:
      return "modify"; // Default to modify for "any"
  }
}

/**
 * Handle a watch event from the file watcher
 */
function handleWatchEvent(event: WatchEvent): void {
  const service = getFileTreeService();
  const cache = getContentCache();

  // Convert to our event format
  const fileEvent: FileChangeEvent = {
    type: mapEventKind(event.kind),
    paths: event.paths,
  };

  // Invalidate content cache for all affected paths
  for (const path of event.paths) {
    cache.invalidate(path);

    // For directory changes, also invalidate children
    if (event.kind === "remove" || event.kind === "create") {
      cache.invalidatePrefix(path + "/");
    }
  }

  // Notify the service (which will notify its subscribers)
  service.notifyChange(fileEvent);
}

/**
 * Connect the file tree service to the file watcher
 * Call this after the watcher has started
 */
export function connectToWatcher(): void {
  if (isConnected) {
    return;
  }

  unsubscribe = onFileChange(handleWatchEvent);
  isConnected = true;
}

/**
 * Disconnect from the file watcher
 */
export function disconnectFromWatcher(): void {
  if (!isConnected || !unsubscribe) {
    return;
  }

  unsubscribe();
  unsubscribe = null;
  isConnected = false;
}

