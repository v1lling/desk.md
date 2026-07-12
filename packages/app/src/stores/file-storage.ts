/**
 * Custom Zustand storage that persists to the local filesystem (.desk/), for
 * DERIVED/telemetry data that stays per-machine (e.g. AI usage). In any non-local
 * posture (remote or browser-mock) it falls back to localStorage — the local disk
 * is either the wrong disk (remote, guarded) or absent (mock).
 */

import { getDeskPath, joinPath } from "@desk/core";
import { getStorage } from "@desk/core";
import { isLocalDisk } from "@/lib/connection";
import type { PersistStorage } from "zustand/middleware";

/**
 * Create a filesystem-based storage for Zustand persist middleware
 * @param subdirectory - Subdirectory under .desk/ (e.g., "index")
 * @param filename - Filename (e.g., "{workspaceId}.json" or "data.json")
 */
export function createFileStorage<T>(subdirectory: string, filename: string): PersistStorage<T> {
  return {
    getItem: async (name: string) => {
      if (!isLocalDisk()) {
        // Fallback to localStorage in browser mode
        const str = localStorage.getItem(name);
        return str ? JSON.parse(str) : null;
      }

      try {
        const deskPath = await getDeskPath();
        const dirPath = await joinPath(deskPath, ".desk", subdirectory);
        const filePath = await joinPath(dirPath, filename);

        // Read from filesystem
        if (await getStorage().exists(filePath)) {
          const content = await getStorage().readTextFile(filePath);
          return content ? JSON.parse(content) : null;
        }

        return null;
      } catch (error) {
        console.error(`[file-storage] Failed to read ${subdirectory}/${filename}:`, error);
        return null;
      }
    },

    setItem: async (name: string, value) => {
      if (!isLocalDisk()) {
        // Fallback to localStorage in browser mode
        localStorage.setItem(name, JSON.stringify(value));
        return;
      }

      try {
        const deskPath = await getDeskPath();
        const dirPath = await joinPath(deskPath, ".desk", subdirectory);

        // Ensure directory exists
        if (!(await getStorage().exists(dirPath))) {
          await getStorage().mkdir(dirPath);
        }

        const filePath = await joinPath(dirPath, filename);
        await getStorage().writeTextFile(filePath, JSON.stringify(value, null, 2));
      } catch (error) {
        console.error(`[file-storage] Failed to write ${subdirectory}/${filename}:`, error);
        throw error; // Re-throw so we know if writes are failing
      }
    },

    removeItem: async (name: string) => {
      if (!isLocalDisk()) {
        localStorage.removeItem(name);
        return;
      }

      // For now, we don't delete index files - just let them exist
      // Could implement file deletion here if needed
    },
  };
}
