/**
 * Search Helpers
 *
 * Reusable search functions for finding items across workspaces.
 * These eliminate duplicated "slow path" fallback logic in tasks, notes, and meetings.
 */

import {
  getDeskPath,
  readDir,
  joinPath,
} from "./tauri-fs";
import { PATH_SEGMENTS } from "./constants";

/**
 * Base interface for items that can be searched
 */
interface SearchableItem {
  id: string;
  workspaceId: string;
  filePath: string;
}

/**
 * Find an item by ID across all workspaces using a fetcher function.
 * This is the "slow path" used when workspaceId is not provided.
 *
 * @param itemId - The ID of the item to find
 * @param fetcher - Function that fetches all items for a given workspaceId
 * @returns The found item or null
 */
export async function findItemInAllWorkspaces<T extends SearchableItem>(
  itemId: string,
  fetcher: (workspaceId: string) => Promise<T[]>
): Promise<T | null> {
  const deskPath = await getDeskPath();
  const workspacesPath = await joinPath(deskPath, PATH_SEGMENTS.WORKSPACES);
  const workspaceEntries = await readDir(workspacesPath);

  for (const workspaceEntry of workspaceEntries) {
    if (!workspaceEntry.isDirectory || workspaceEntry.name.startsWith(".")) continue;

    const items = await fetcher(workspaceEntry.name);
    const item = items.find((i) => i.id === itemId);

    if (item) {
      return item;
    }
  }

  return null;
}

/**
 * Execute an operation on an item found across all workspaces.
 * Combines finding and operating on an item in the slow path.
 *
 * @param itemId - The ID of the item to find
 * @param fetcher - Function that fetches all items for a given workspaceId
 * @param operation - Async function to execute on the found item
 * @returns The result of the operation or null if item not found
 */
export async function withItemFromAllWorkspaces<T extends SearchableItem, R>(
  itemId: string,
  fetcher: (workspaceId: string) => Promise<T[]>,
  operation: (item: T) => Promise<R>
): Promise<R | null> {
  const item = await findItemInAllWorkspaces(itemId, fetcher);

  if (item) {
    return operation(item);
  }

  return null;
}
