/**
 * Open Editor Registry
 *
 * Tracks all files currently open in editor tabs.
 * Handles path changes (move/rename) and deletions while editing.
 *
 * This is the central registry that determines whether file watcher
 * events should be routed to editors (open files) or to TanStack Query
 * cache invalidation (closed files).
 */

import { create } from "zustand";

export type EditorType = "doc" | "task" | "meeting";

export interface EditorSession {
  path: string; // Absolute file path (source of truth)
  type: EditorType;
  entityId: string;
  lastSavedContent: string; // What WE last wrote to disk

  // Path change handling
  newPath: string | null; // Set when file was moved/renamed
  isDeleted: boolean; // Set when file was deleted
}

interface OpenEditorRegistryState {
  sessions: Map<string, EditorSession>;

  // Lifecycle
  register(
    path: string,
    session: Omit<EditorSession, "path" | "newPath" | "isDeleted">
  ): void;
  unregister(path: string): void;

  // State updates
  updateLastSaved(path: string, content: string): void;

  // Queries
  isOpen(path: string): boolean;
  getSession(path: string): EditorSession | undefined;
  getSessionByEntityId(
    type: EditorType,
    entityId: string
  ): EditorSession | undefined;
  getAllOpenPaths(): string[];

  // Path change handling (called by domain operations)
  handlePathChange(oldPath: string, newPath: string): void;
  handlePathDeleted(path: string): void;

  // Clear path change flags (after editor acknowledges)
  acknowledgePathChange(oldPath: string): void;
  acknowledgeDeleted(path: string): void;
}

export const useOpenEditorRegistry = create<OpenEditorRegistryState>(
  (set, get) => ({
    sessions: new Map(),

    register(path, sessionData) {
      set((state) => {
        const sessions = new Map(state.sessions);
        sessions.set(path, {
          ...sessionData,
          path,
          newPath: null,
          isDeleted: false,
        });
        return { sessions };
      });
      console.log("[editor-registry] Registered:", path);
    },

    unregister(path) {
      set((state) => {
        const sessions = new Map(state.sessions);
        sessions.delete(path);
        return { sessions };
      });
      console.log("[editor-registry] Unregistered:", path);
    },

    updateLastSaved(path, content) {
      set((state) => {
        const sessions = new Map(state.sessions);
        const session = sessions.get(path);
        if (session) {
          sessions.set(path, { ...session, lastSavedContent: content });
        }
        return { sessions };
      });
    },

    isOpen(path) {
      return get().sessions.has(path);
    },

    getSession(path) {
      return get().sessions.get(path);
    },

    getSessionByEntityId(type, entityId) {
      for (const session of get().sessions.values()) {
        if (session.type === type && session.entityId === entityId) {
          return session;
        }
      }
      return undefined;
    },

    getAllOpenPaths() {
      return Array.from(get().sessions.keys());
    },

    // Called when a file is moved/renamed
    handlePathChange(oldPath, newPath) {
      set((state) => {
        const sessions = new Map(state.sessions);
        const session = sessions.get(oldPath);
        if (session) {
          // Mark the session with the new path
          sessions.set(oldPath, { ...session, newPath });
          console.log("[editor-registry] Path change:", oldPath, "→", newPath);
        }
        return { sessions };
      });
    },

    // Called when a file is deleted
    handlePathDeleted(path) {
      set((state) => {
        const sessions = new Map(state.sessions);
        const session = sessions.get(path);
        if (session) {
          sessions.set(path, { ...session, isDeleted: true });
          console.log("[editor-registry] Path deleted:", path);
        }
        return { sessions };
      });
    },

    // Editor calls this after handling the path change
    acknowledgePathChange(oldPath) {
      const session = get().sessions.get(oldPath);
      if (session && session.newPath) {
        set((state) => {
          const sessions = new Map(state.sessions);
          sessions.delete(oldPath);
          sessions.set(session.newPath!, {
            ...session,
            path: session.newPath!,
            newPath: null,
          });
          return { sessions };
        });
        console.log(
          "[editor-registry] Acknowledged path change:",
          oldPath,
          "→",
          session.newPath
        );
      }
    },

    acknowledgeDeleted(path) {
      // Editor should close itself after acknowledging
      get().unregister(path);
      console.log("[editor-registry] Acknowledged deletion:", path);
    },
  })
);

/**
 * Helper to check if a path is open in any editor
 * Can be called outside of React components
 */
export function isPathOpen(path: string): boolean {
  return useOpenEditorRegistry.getState().isOpen(path);
}

/**
 * Helper to get session for a path
 * Can be called outside of React components
 */
export function getEditorSession(path: string): EditorSession | undefined {
  return useOpenEditorRegistry.getState().getSession(path);
}
