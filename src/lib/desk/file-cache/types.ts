/**
 * File Tree Types
 *
 * Core types for the file tree service that provides
 * cached, efficient access to the Desk directory structure.
 */

/**
 * Represents a node in the file tree (file or directory)
 */
export interface TreeNode {
  /** Absolute path on disk */
  path: string;

  /** Path relative to Desk root (e.g., "workspaces/acme/docs/readme.md") */
  relativePath: string;

  /** File or folder name */
  name: string;

  /** Node type */
  type: "file" | "directory";

  /** File extension without dot (e.g., "md", "json") - only for files */
  extension?: string;

  /** File size in bytes - only for files */
  size?: number;

  /** Last modified timestamp (ms since epoch) */
  mtime?: number;

  /** Children nodes - only for directories */
  children?: TreeNode[];

  /** Whether children have been loaded - only for directories */
  childrenLoaded?: boolean;
}

/**
 * Options for tree traversal
 */
export interface TraversalOptions {
  /** Maximum depth to traverse (undefined = unlimited) */
  maxDepth?: number;

  /** File extensions to include (e.g., ["md", "json"]) - undefined = all */
  extensions?: string[];

  /** Whether to include hidden files/folders (starting with .) */
  includeHidden?: boolean;

  /** Folder names to exclude */
  excludeFolders?: string[];
}

/**
 * Cached file content with metadata for invalidation
 */
export interface CachedContent<T = unknown> {
  /** Absolute file path */
  path: string;

  /** Last modified time when cached (for invalidation) */
  mtime: number;

  /** Raw file content */
  raw: string;

  /** Parsed/transformed content */
  parsed: T;

  /** Size of raw content in bytes (for LRU eviction) */
  size: number;

  /** When this was cached (ms since epoch) */
  cachedAt: number;
}

/**
 * Content cache statistics
 */
export interface CacheStats {
  /** Number of items in cache */
  itemCount: number;

  /** Total size of cached content in bytes */
  totalSize: number;

  /** Maximum allowed size in bytes */
  maxSize: number;

  /** Cache hit count since start */
  hits: number;

  /** Cache miss count since start */
  misses: number;

  /** Hit rate as percentage */
  hitRate: number;
}

/**
 * File change event from watcher
 */
export interface FileChangeEvent {
  /** Type of change */
  type: "create" | "modify" | "delete" | "rename";

  /** Affected path(s) */
  paths: string[];

  /** For renames: the old path */
  oldPath?: string;
}

/**
 * Subscription callback for tree changes
 */
export type TreeChangeCallback = (
  event: FileChangeEvent,
  affectedNodes: TreeNode[]
) => void;

/**
 * Parser function for transforming raw file content
 */
export type ContentParser<T> = (raw: string, path: string) => T;

/**
 * File tree service interface
 */
export interface IFileTreeService {
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): void;
  isInitialized(): boolean;

  // Tree queries
  getTree(relativePath?: string): Promise<TreeNode | null>;
  getChildren(relativePath: string, options?: TraversalOptions): Promise<TreeNode[]>;
  getNode(relativePath: string): Promise<TreeNode | null>;

  // Content access (with caching)
  getContent<T>(relativePath: string, parser?: ContentParser<T>): Promise<T | null>;
  getRawContent(relativePath: string): Promise<string | null>;

  // Subscriptions
  subscribe(relativePath: string, callback: TreeChangeCallback): () => void;

  // Cache management
  getCacheStats(): CacheStats;
  clearCache(): void;
  invalidateCache(relativePath: string): void;

  // Write operations (updates cache + disk)
  writeFile(relativePath: string, content: string): Promise<void>;
  createDirectory(relativePath: string): Promise<void>;
  deleteNode(relativePath: string): Promise<void>;
  renameNode(oldPath: string, newPath: string): Promise<void>;
}
