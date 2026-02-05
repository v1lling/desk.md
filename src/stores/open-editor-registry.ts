/**
 * Open Editor Registry
 *
 * Tracks all files currently open in editor tabs.
 * Used by file watcher to distinguish our saves from external changes.
 *
 * Key responsibilities:
 * - Track which files are open (for routing file watcher events)
 * - Store lastSavedContent to detect external vs our saves
 * - Handle path changes (move/rename) and deletions while editing
 */

import { create } from "zustand";

export type EditorType = "doc" | "task" | "meeting";

export interface EditorSession {
  path: string;
  type: EditorType;
  entityId: string;
  /** What we last wrote to disk (for external change detection) */
  lastSavedContent: string;
  /** Set when file was moved/renamed externally */
  newPath: string | null;
  /** Set when file was deleted externally */
  isDeleted: boolean;
}

interface OpenEditorRegistryState {
  sessions: Map<string, EditorSession>;

  // Lifecycle
  register(path: string, session: { type: EditorType; entityId: string }): void;
  unregister(path: string): void;

  // State updates
  updateLastSaved(path: string, content: string): void;

  // Queries
  isOpen(path: string): boolean;
  getSession(path: string): EditorSession | undefined;
  getSessionByEntityId(type: EditorType, entityId: string): EditorSession | undefined;
  getAllOpenPaths(): string[];

  // Path change handling (called by domain operations)
  handlePathChange(oldPath: string, newPath: string): void;
  handlePathDeleted(path: string): void;

  // Clear path change flags (after editor acknowledges)
  acknowledgePathChange(oldPath: string): void;
  acknowledgeDeleted(path: string): void;
}

export const useOpenEditorRegistry = create<OpenEditorRegistryState>((set, get) => ({
  sessions: new Map(),

  register(path, { type, entityId }) {
    set((state) => {
      const sessions = new Map(state.sessions);
      sessions.set(path, {
        path,
        type,
        entityId,
        lastSavedContent: "", // Set later via updateLastSaved after loading from disk
        newPath: null,
        isDeleted: false,
      });
      return { sessions };
    });
  },

  unregister(path) {
    set((state) => {
      const sessions = new Map(state.sessions);
      sessions.delete(path);
      return { sessions };
    });
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

  handlePathChange(oldPath, newPath) {
    set((state) => {
      const sessions = new Map(state.sessions);
      const session = sessions.get(oldPath);
      if (session) {
        sessions.set(oldPath, { ...session, newPath });
      }
      return { sessions };
    });
  },

  handlePathDeleted(path) {
    set((state) => {
      const sessions = new Map(state.sessions);
      const session = sessions.get(path);
      if (session) {
        sessions.set(path, { ...session, isDeleted: true });
      }
      return { sessions };
    });
  },

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
    }
  },

  acknowledgeDeleted(path) {
    get().unregister(path);
  },
}));

/** Check if a path is open in any editor (can be called outside React) */
export function isPathOpen(path: string): boolean {
  return useOpenEditorRegistry.getState().isOpen(path);
}

/** Get session for a path (can be called outside React) */
export function getEditorSession(path: string): EditorSession | undefined {
  return useOpenEditorRegistry.getState().getSession(path);
}
