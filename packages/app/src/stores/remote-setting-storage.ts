/**
 * Zustand persist storage for user-level settings that should follow the user
 * across devices (templates, agent instructions, the week planner).
 *
 * Unlike a plain local-file zustand storage (which would write via the local getStorage() and stay
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
import type { PersistStorage, StorageValue } from "zustand/middleware";

const isBrowserMock = !isTauri() && !import.meta.env.VITE_DESK_HOSTED;

/**
 * The zustand persist envelope (`{state, version}`) stays contained HERE: `.desk/settings/*.json`
 * on disk is plain state, so a core reader (the maintenance engine's `config.ts`) sees a plain
 * object, not a UI library's persistence format. We unwrap on write and re-wrap on read.
 */
async function readRaw(name: string, key: string): Promise<string | null> {
  return isBrowserMock ? localStorage.getItem(name) : getDeskService().getSetting(key);
}

async function writeRaw(name: string, key: string, value: string): Promise<void> {
  if (isBrowserMock) localStorage.setItem(name, value);
  else await getDeskService().setSetting(key, value);
}

export function createRemoteSettingStorage<T>(key: string): PersistStorage<T> {
  return {
    getItem: async (name): Promise<StorageValue<T> | null> => {
      const raw = await readRaw(name, key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (parsed === null) return null; // removed / empty
      // On disk it's plain state; re-wrap in the persist envelope zustand expects.
      return { state: parsed as T, version: 0 };
    },

    setItem: async (name, value) => {
      // Store just the state — the envelope is a persist detail that must not leak to disk.
      await writeRaw(name, key, JSON.stringify(value.state));
    },

    removeItem: async (name) => {
      // No hard delete on the seam; an empty value reads back as "no state".
      await writeRaw(name, key, JSON.stringify(null));
    },
  };
}
