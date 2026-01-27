/**
 * File Tree Service
 *
 * Centralized service for efficient file system access.
 * Provides caching, tree building, and change notifications.
 */

import type {
  TreeNode,
  TraversalOptions,
  CacheStats,
  ContentParser,
  FileChangeEvent,
  TreeChangeCallback,
  IFileTreeService,
} from "./types";
import { buildTree, buildNode, getOrbitRoot, isFileSystemAvailable } from "./tree-builder";
import { ContentCache, getContentCache } from "./content-cache";
import {
  readTextFile,
  writeTextFile,
  mkdir,
  removeFile,
  removeDir,
  rename,
  joinPath,
  exists,
} from "../tauri-fs";

/**
 * File Tree Service implementation
 */
class FileTreeService implements IFileTreeService {
  private initialized = false;
  private orbitRoot: string = "";
  private cache: ContentCache;
  private subscribers = new Map<string, Set<TreeChangeCallback>>();

  // In-memory tree cache (root node with children)
  private treeCache: TreeNode | null = null;
  private treeCacheTime: number = 0;
  private readonly TREE_CACHE_TTL = 5000; // 5 seconds

  constructor() {
    this.cache = getContentCache();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!isFileSystemAvailable()) {
      console.log("[FileTreeService] File system not available (browser mode)");
      this.initialized = true;
      return;
    }

    this.orbitRoot = await getOrbitRoot();
    this.initialized = true;
    console.log("[FileTreeService] Initialized with root:", this.orbitRoot);
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    this.cache.clear();
    this.subscribers.clear();
    this.treeCache = null;
    this.initialized = false;
    console.log("[FileTreeService] Shutdown");
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get tree starting from a relative path
   */
  async getTree(relativePath: string = ""): Promise<TreeNode | null> {
    await this.ensureInitialized();

    if (!isFileSystemAvailable()) {
      return null;
    }

    // For root with no specific path, use cached tree if fresh
    if (relativePath === "" && this.treeCache && Date.now() - this.treeCacheTime < this.TREE_CACHE_TTL) {
      return this.treeCache;
    }

    const absolutePath = relativePath
      ? await joinPath(this.orbitRoot, relativePath)
      : this.orbitRoot;

    if (!(await exists(absolutePath))) {
      return null;
    }

    const name = relativePath ? relativePath.split("/").pop() || relativePath : "Orbit";
    const children = await buildTree(this.orbitRoot, relativePath);

    const node: TreeNode = {
      path: absolutePath,
      relativePath,
      name,
      type: "directory",
      children,
      childrenLoaded: true,
    };

    // Cache root tree
    if (relativePath === "") {
      this.treeCache = node;
      this.treeCacheTime = Date.now();
    }

    return node;
  }

  /**
   * Get children of a directory
   */
  async getChildren(relativePath: string, options?: TraversalOptions): Promise<TreeNode[]> {
    await this.ensureInitialized();

    if (!isFileSystemAvailable()) {
      return [];
    }

    return buildTree(this.orbitRoot, relativePath, options, 0);
  }

  /**
   * Get a single node by path
   */
  async getNode(relativePath: string): Promise<TreeNode | null> {
    await this.ensureInitialized();

    if (!isFileSystemAvailable()) {
      return null;
    }

    return buildNode(this.orbitRoot, relativePath);
  }

  /**
   * Get parsed file content with caching
   */
  async getContent<T>(relativePath: string, parser?: ContentParser<T>): Promise<T | null> {
    await this.ensureInitialized();

    if (!isFileSystemAvailable()) {
      return null;
    }

    const absolutePath = await joinPath(this.orbitRoot, relativePath);

    if (!(await exists(absolutePath))) {
      return null;
    }

    // Check cache first (without mtime check for now - we'll add that with watcher)
    const cached = this.cache.get<T>(absolutePath);
    if (cached) {
      return cached.parsed;
    }

    // Read from disk
    try {
      const raw = await readTextFile(absolutePath);
      const parsed = parser ? parser(raw, relativePath) : (raw as unknown as T);

      // Cache the result
      this.cache.set(absolutePath, raw, parsed, Date.now());

      return parsed;
    } catch (error) {
      console.error(`[FileTreeService] Failed to read: ${relativePath}`, error);
      return null;
    }
  }

  /**
   * Get raw file content
   */
  async getRawContent(relativePath: string): Promise<string | null> {
    return this.getContent<string>(relativePath, (raw) => raw);
  }

  /**
   * Get parsed file content by absolute path (with caching)
   * Use this when you already have the absolute path
   */
  async getContentByAbsolutePath<T>(
    absolutePath: string,
    parser?: ContentParser<T>
  ): Promise<T | null> {
    await this.ensureInitialized();

    if (!isFileSystemAvailable()) {
      return null;
    }

    if (!(await exists(absolutePath))) {
      return null;
    }

    // Check cache first
    const cached = this.cache.get<T>(absolutePath);
    if (cached) {
      return cached.parsed;
    }

    // Read from disk
    try {
      const raw = await readTextFile(absolutePath);
      const parsed = parser ? parser(raw, absolutePath) : (raw as unknown as T);

      // Cache the result
      this.cache.set(absolutePath, raw, parsed, Date.now());

      return parsed;
    } catch (error) {
      console.error(`[FileTreeService] Failed to read: ${absolutePath}`, error);
      return null;
    }
  }

  /**
   * Subscribe to changes at a path
   */
  subscribe(relativePath: string, callback: TreeChangeCallback): () => void {
    if (!this.subscribers.has(relativePath)) {
      this.subscribers.set(relativePath, new Set());
    }
    this.subscribers.get(relativePath)!.add(callback);

    return () => {
      const subs = this.subscribers.get(relativePath);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(relativePath);
        }
      }
    };
  }

  /**
   * Notify subscribers of a change
   * Called by watcher integration (to be added)
   */
  notifyChange(event: FileChangeEvent): void {
    // Invalidate tree cache
    this.treeCache = null;

    // Invalidate content cache for affected paths
    for (const path of event.paths) {
      this.cache.invalidate(path);
    }

    // Notify subscribers
    // For now, notify all subscribers - we can optimize this later
    for (const [, callbacks] of this.subscribers) {
      for (const callback of callbacks) {
        try {
          callback(event, []);
        } catch (error) {
          console.error("[FileTreeService] Subscriber error:", error);
        }
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.treeCache = null;
  }

  /**
   * Invalidate cache for a specific path
   */
  invalidateCache(relativePath: string): void {
    const absolutePath = this.orbitRoot
      ? `${this.orbitRoot}/${relativePath}`
      : relativePath;
    this.cache.invalidate(absolutePath);
    this.treeCache = null;
  }

  /**
   * Write file and update cache
   */
  async writeFile(relativePath: string, content: string): Promise<void> {
    await this.ensureInitialized();

    if (!isFileSystemAvailable()) {
      throw new Error("File system not available");
    }

    const absolutePath = await joinPath(this.orbitRoot, relativePath);
    await writeTextFile(absolutePath, content);

    // Invalidate cache
    this.cache.invalidate(absolutePath);
    this.treeCache = null;

    // Notify subscribers
    this.notifyChange({
      type: "modify",
      paths: [absolutePath],
    });
  }

  /**
   * Create directory
   */
  async createDirectory(relativePath: string): Promise<void> {
    await this.ensureInitialized();

    if (!isFileSystemAvailable()) {
      throw new Error("File system not available");
    }

    const absolutePath = await joinPath(this.orbitRoot, relativePath);
    await mkdir(absolutePath);

    // Invalidate tree cache
    this.treeCache = null;

    // Notify subscribers
    this.notifyChange({
      type: "create",
      paths: [absolutePath],
    });
  }

  /**
   * Delete file or directory
   */
  async deleteNode(relativePath: string): Promise<void> {
    await this.ensureInitialized();

    if (!isFileSystemAvailable()) {
      throw new Error("File system not available");
    }

    const absolutePath = await joinPath(this.orbitRoot, relativePath);
    const node = await this.getNode(relativePath);

    if (!node) {
      throw new Error(`Path not found: ${relativePath}`);
    }

    if (node.type === "directory") {
      await removeDir(absolutePath);
    } else {
      await removeFile(absolutePath);
    }

    // Invalidate caches
    this.cache.invalidate(absolutePath);
    this.cache.invalidatePrefix(absolutePath + "/");
    this.treeCache = null;

    // Notify subscribers
    this.notifyChange({
      type: "delete",
      paths: [absolutePath],
    });
  }

  /**
   * Rename file or directory
   */
  async renameNode(oldRelativePath: string, newRelativePath: string): Promise<void> {
    await this.ensureInitialized();

    if (!isFileSystemAvailable()) {
      throw new Error("File system not available");
    }

    const oldAbsolutePath = await joinPath(this.orbitRoot, oldRelativePath);
    const newAbsolutePath = await joinPath(this.orbitRoot, newRelativePath);

    await rename(oldAbsolutePath, newAbsolutePath);

    // Invalidate caches
    this.cache.invalidate(oldAbsolutePath);
    this.cache.invalidatePrefix(oldAbsolutePath + "/");
    this.treeCache = null;

    // Notify subscribers
    this.notifyChange({
      type: "rename",
      paths: [newAbsolutePath],
      oldPath: oldAbsolutePath,
    });
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// Singleton instance
let serviceInstance: FileTreeService | null = null;

/**
 * Get the global FileTreeService instance
 */
export function getFileTreeService(): FileTreeService {
  if (!serviceInstance) {
    serviceInstance = new FileTreeService();
  }
  return serviceInstance;
}

/**
 * Reset the service (for testing)
 */
export function resetFileTreeService(): void {
  serviceInstance?.shutdown();
  serviceInstance = null;
}
