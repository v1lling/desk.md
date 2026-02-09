/**
 * Custom Zustand storage that persists to filesystem instead of localStorage
 * Used for Smart Index to enable cross-device sync and backups
 */

import { getDeskPath, joinPath } from "@/lib/desk/tauri-fs";
import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { isTauri } from "@/lib/desk";
import type { StateStorage } from "zustand/middleware";

/**
 * Create a filesystem-based storage for Zustand persist middleware
 * @param subdirectory - Subdirectory under .desk/ (e.g., "index")
 * @param filename - Filename (e.g., "{workspaceId}.json" or "data.json")
 */
export function createFileStorage(subdirectory: string, filename: string): StateStorage {
  return {
    getItem: async (name: string): Promise<string | null> => {
      if (!isTauri()) {
        // Fallback to localStorage in browser mode
        return localStorage.getItem(name);
      }

      try {
        const deskPath = await getDeskPath();
        const dirPath = await joinPath(deskPath, ".desk", subdirectory);
        const filePath = await joinPath(dirPath, filename);

        if (!(await exists(filePath))) {
          return null;
        }

        const content = await readTextFile(filePath);
        return content;
      } catch (error) {
        console.warn(`[file-storage] Failed to read ${subdirectory}/${filename}:`, error);
        return null;
      }
    },

    setItem: async (name: string, value: string): Promise<void> => {
      if (!isTauri()) {
        // Fallback to localStorage in browser mode
        localStorage.setItem(name, value);
        return;
      }

      try {
        const deskPath = await getDeskPath();
        const dirPath = await joinPath(deskPath, ".desk", subdirectory);

        // Ensure directory exists
        if (!(await exists(dirPath))) {
          await mkdir(dirPath, { recursive: true });
        }

        const filePath = await joinPath(dirPath, filename);
        await writeTextFile(filePath, value);
      } catch (error) {
        console.error(`[file-storage] Failed to write ${subdirectory}/${filename}:`, error);
      }
    },

    removeItem: async (name: string): Promise<void> => {
      if (!isTauri()) {
        localStorage.removeItem(name);
        return;
      }

      // For now, we don't delete index files - just let them exist
      // Could implement file deletion here if needed
    },
  };
}

/**
 * Create filesystem storage for context indexes
 * Stores all workspace indexes in a single file: .desk/index/indexes.json
 */
export function createContextIndexStorage(): StateStorage {
  return createFileStorage("index", "indexes.json");
}
