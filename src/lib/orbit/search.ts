/**
 * Search Helpers
 *
 * Reusable search functions for finding items across areas.
 * These eliminate duplicated "slow path" fallback logic in tasks, notes, and meetings.
 */

import {
  getOrbitPath,
  readDir,
  joinPath,
} from "./tauri-fs";
import { PATH_SEGMENTS } from "./constants";

/**
 * Base interface for items that can be searched
 */
interface SearchableItem {
  id: string;
  areaId: string;
  filePath: string;
}

/**
 * Find an item by ID across all areas using a fetcher function.
 * This is the "slow path" used when areaId is not provided.
 *
 * @param itemId - The ID of the item to find
 * @param fetcher - Function that fetches all items for a given areaId
 * @returns The found item or null
 */
export async function findItemInAllAreas<T extends SearchableItem>(
  itemId: string,
  fetcher: (areaId: string) => Promise<T[]>
): Promise<T | null> {
  const orbitPath = await getOrbitPath();
  const areasPath = await joinPath(orbitPath, PATH_SEGMENTS.AREAS);
  const areaEntries = await readDir(areasPath);

  for (const areaEntry of areaEntries) {
    if (!areaEntry.isDirectory || areaEntry.name.startsWith(".")) continue;

    const items = await fetcher(areaEntry.name);
    const item = items.find((i) => i.id === itemId);

    if (item) {
      return item;
    }
  }

  return null;
}

/**
 * Execute an operation on an item found across all areas.
 * Combines finding and operating on an item in the slow path.
 *
 * @param itemId - The ID of the item to find
 * @param fetcher - Function that fetches all items for a given areaId
 * @param operation - Async function to execute on the found item
 * @returns The result of the operation or null if item not found
 */
export async function withItemFromAllAreas<T extends SearchableItem, R>(
  itemId: string,
  fetcher: (areaId: string) => Promise<T[]>,
  operation: (item: T) => Promise<R>
): Promise<R | null> {
  const item = await findItemInAllAreas(itemId, fetcher);

  if (item) {
    return operation(item);
  }

  return null;
}
