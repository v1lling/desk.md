/**
 * Zustand persist storage for user-level settings that should follow the user
 * across devices (templates, agent instructions, the week planner).
 *
 * Unlike `file-storage.ts` (which writes via the local `getStorage()` and so stays
 * on *this* machine even in hosted mode), this adapter routes through
 * `getDeskService().getSetting/setSetting`. So the data lands wherever the domain
 * runs: the server's `.desk/settings/<key>.json` in hosted mode (shared), the local
 * disk in Tauri local mode — exactly like content.
 *
 * Browser-mock dev (no real backend) has no DeskService to persist to, so it falls
 * back to localStorage, keeping the dev loop unchanged. "Browser-mock" = not Tauri
 * AND not the hosted web build; the hosted web build (`VITE_DESK_HOSTED`) has a real
 * RemoteDeskService and uses it.
 */
import { getDeskService, isTauri } from "@desk/core";
import type { PersistStorage } from "zustand/middleware";

const isBrowserMock = !isTauri() && !import.meta.env.VITE_DESK_HOSTED;

export function createRemoteSettingStorage<T>(key: string): PersistStorage<T> {
  return {
    getItem: async (name) => {
      if (isBrowserMock) {
        const str = localStorage.getItem(name);
        return str ? JSON.parse(str) : null;
      }
      const raw = await getDeskService().getSetting(key);
      return raw ? JSON.parse(raw) : null;
    },

    setItem: async (name, value) => {
      if (isBrowserMock) {
        localStorage.setItem(name, JSON.stringify(value));
        return;
      }
      await getDeskService().setSetting(key, JSON.stringify(value));
    },

    removeItem: async (name) => {
      if (isBrowserMock) {
        localStorage.removeItem(name);
        return;
      }
      // No hard delete on the seam; an empty value reads back as "no state".
      await getDeskService().setSetting(key, JSON.stringify(null));
    },
  };
}

/**
 * Like {@link createRemoteSettingStorage} but for the Smart Index cache, which has
 * its own DeskService method pair (`getIndexCache`/`setIndexCache` →
 * `.desk/index/indexes.json`) so the catalog follows the domain server-side in
 * hosted mode. DERIVED, not a user setting — kept on its own seam, same browser-
 * mock localStorage fallback for the dev loop.
 */
export function createRemoteIndexStorage<T>(): PersistStorage<T> {
  return {
    getItem: async (name) => {
      if (isBrowserMock) {
        const str = localStorage.getItem(name);
        return str ? JSON.parse(str) : null;
      }
      const raw = await getDeskService().getIndexCache();
      return raw ? JSON.parse(raw) : null;
    },

    setItem: async (name, value) => {
      if (isBrowserMock) {
        localStorage.setItem(name, JSON.stringify(value));
        return;
      }
      await getDeskService().setIndexCache(JSON.stringify(value));
    },

    removeItem: async (name) => {
      if (isBrowserMock) {
        localStorage.removeItem(name);
        return;
      }
      await getDeskService().setIndexCache(JSON.stringify(null));
    },
  };
}
