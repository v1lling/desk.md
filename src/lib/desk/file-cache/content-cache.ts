/**
 * Content Cache
 *
 * LRU cache for parsed file contents.
 * Invalidates on file modification (mtime change).
 */

import type { CachedContent, CacheStats, ContentParser } from "./types";

/**
 * Default cache configuration
 */
const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_MAX_AGE = 30 * 60 * 1000; // 30 minutes

/**
 * LRU Content Cache implementation
 */
export class ContentCache {
  private cache = new Map<string, CachedContent>();
  private accessOrder: string[] = []; // Most recently accessed at end
  private maxSize: number;
  private maxAge: number;

  // Stats
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = DEFAULT_MAX_SIZE, maxAge: number = DEFAULT_MAX_AGE) {
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  /**
   * Get cached content if valid
   */
  get<T>(path: string, currentMtime?: number): CachedContent<T> | null {
    const entry = this.cache.get(path) as CachedContent<T> | undefined;

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if stale by mtime
    if (currentMtime !== undefined && entry.mtime !== currentMtime) {
      this.invalidate(path);
      this.misses++;
      return null;
    }

    // Check if expired by age
    if (Date.now() - entry.cachedAt > this.maxAge) {
      this.invalidate(path);
      this.misses++;
      return null;
    }

    // Update access order (move to end)
    this.updateAccessOrder(path);
    this.hits++;

    return entry;
  }

  /**
   * Store content in cache
   */
  set<T>(
    path: string,
    raw: string,
    parsed: T,
    mtime: number
  ): void {
    const size = raw.length;

    // Evict if needed to make room
    while (this.getTotalSize() + size > this.maxSize && this.cache.size > 0) {
      this.evictOldest();
    }

    // Don't cache if single item exceeds max size
    if (size > this.maxSize) {
      console.warn(`[ContentCache] File too large to cache: ${path} (${size} bytes)`);
      return;
    }

    const entry: CachedContent<T> = {
      path,
      mtime,
      raw,
      parsed,
      size,
      cachedAt: Date.now(),
    };

    this.cache.set(path, entry);
    this.updateAccessOrder(path);
  }

  /**
   * Invalidate a specific path
   */
  invalidate(path: string): void {
    this.cache.delete(path);
    this.accessOrder = this.accessOrder.filter((p) => p !== path);
  }

  /**
   * Invalidate all paths matching a prefix (for directory changes)
   */
  invalidatePrefix(prefix: string): void {
    const toDelete: string[] = [];

    for (const path of this.cache.keys()) {
      if (path.startsWith(prefix)) {
        toDelete.push(path);
      }
    }

    for (const path of toDelete) {
      this.invalidate(path);
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      itemCount: this.cache.size,
      totalSize: this.getTotalSize(),
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get total size of cached content
   */
  private getTotalSize(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size;
    }
    return total;
  }

  /**
   * Evict the least recently used item
   */
  private evictOldest(): void {
    if (this.accessOrder.length === 0) return;

    const oldest = this.accessOrder.shift();
    if (oldest) {
      this.cache.delete(oldest);
    }
  }

  /**
   * Update access order (move to end = most recent)
   */
  private updateAccessOrder(path: string): void {
    const index = this.accessOrder.indexOf(path);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(path);
  }
}

/**
 * Singleton cache instance
 */
let globalCache: ContentCache | null = null;

/**
 * Get the global content cache instance
 */
export function getContentCache(): ContentCache {
  if (!globalCache) {
    globalCache = new ContentCache();
  }
  return globalCache;
}

/**
 * Reset the global cache (for testing)
 */
export function resetContentCache(): void {
  globalCache?.clear();
  globalCache = null;
}
