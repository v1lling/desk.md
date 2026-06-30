
import { useMemo } from "react";

/**
 * Hook to group items by a key extractor function.
 * Returns a record of arrays, where each key maps to items with that key.
 */
export function useGroupedItems<T, K extends string>(
  items: T[],
  getKey: (item: T) => K
): Record<K, T[]> {
  return useMemo(() => {
    const groups = {} as Record<K, T[]>;
    items.forEach((item) => {
      const key = getKey(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [items, getKey]);
}
