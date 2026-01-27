/**
 * Editor Event Bus
 *
 * Simple pub/sub for routing file system events to open editors.
 * When the file watcher detects an external change to an open file,
 * it publishes the new content here, and the editor receives it.
 *
 * Events:
 * - onContentUpdate: External edit detected, editor should update
 * - onPathChange: File was moved/renamed, editor should acknowledge
 * - onDeleted: File was deleted, editor should close
 */

type ContentUpdateHandler = (content: string) => void;
type PathChangeHandler = (newPath: string) => void;
type DeletedHandler = () => void;

export interface EditorEventHandlers {
  onContentUpdate?: ContentUpdateHandler;
  onPathChange?: PathChangeHandler;
  onDeleted?: DeletedHandler;
}

// Subscribers by file path
const subscribers = new Map<string, EditorEventHandlers>();

/**
 * Subscribe to events for a specific file path.
 * Returns an unsubscribe function.
 */
export function subscribeToEditorEvents(
  path: string,
  handlers: EditorEventHandlers
): () => void {
  subscribers.set(path, handlers);
  return () => subscribers.delete(path);
}

/**
 * Publish a content update to the editor for a specific file.
 * Called when the file watcher detects an external change.
 */
export function publishContentUpdate(path: string, content: string): void {
  const handlers = subscribers.get(path);
  if (handlers?.onContentUpdate) {
    handlers.onContentUpdate(content);
    console.log("[event-bus] Content update published:", path.split("/").pop());
  }
}

/**
 * Publish a path change to the editor.
 * Called when the file is moved or renamed.
 */
export function publishPathChange(path: string, newPath: string): void {
  const handlers = subscribers.get(path);
  if (handlers?.onPathChange) {
    handlers.onPathChange(newPath);
    console.log(
      "[event-bus] Path change published:",
      path.split("/").pop(),
      "→",
      newPath.split("/").pop()
    );
  }
}

/**
 * Publish a deletion event to the editor.
 * Called when the file is deleted.
 */
export function publishDeleted(path: string): void {
  const handlers = subscribers.get(path);
  if (handlers?.onDeleted) {
    handlers.onDeleted();
    console.log("[event-bus] Deleted published:", path.split("/").pop());
  }
}

/**
 * Check if a path has any subscribers
 */
export function hasSubscribers(path: string): boolean {
  return subscribers.has(path);
}

/**
 * Get count of active subscriptions (for debugging)
 */
export function getSubscriberCount(): number {
  return subscribers.size;
}
