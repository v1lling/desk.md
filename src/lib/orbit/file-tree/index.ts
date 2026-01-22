/**
 * File Tree Module
 *
 * Centralized file system access with caching and tree building.
 */

// Types
export type {
  TreeNode,
  TraversalOptions,
  CachedContent,
  CacheStats,
  FileChangeEvent,
  TreeChangeCallback,
  ContentParser,
  IFileTreeService,
} from "./types";

// Tree building
export {
  buildTree,
  buildNode,
  getOrbitRoot,
  isFileSystemAvailable,
} from "./tree-builder";

// Content cache
export {
  ContentCache,
  getContentCache,
  resetContentCache,
} from "./content-cache";

// Service
export {
  getFileTreeService,
  resetFileTreeService,
} from "./service";

// React hooks
export {
  fileTreeKeys,
  useFileTreeInit,
  useFileTree,
  useFileTreeChildren,
  useFileTreeNode,
  useFileContent,
  useRawFileContent,
  useFileTreeCacheStats,
  useInvalidateFileTree,
  useFileTreeSubscription,
} from "./hooks";

// Watcher integration
export {
  connectToWatcher,
  disconnectFromWatcher,
  isWatcherConnected,
} from "./watcher-integration";

// Parsers
export type {
  ParsedMarkdownDoc,
  ParsedDoc,
  ParsedTask,
} from "./parsers";
export {
  parseMarkdownDoc,
  createDocParser,
  createTaskParser,
  parseJson,
  parsePlainText,
} from "./parsers";
