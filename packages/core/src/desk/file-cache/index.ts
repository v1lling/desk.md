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
  getDeskRoot,
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

// Note: the React file-tree hooks (./hooks) and the watcher cache-invalidator
// (./cache-invalidator) are UI/Tauri glue and live in the app now
// (packages/app/src/lib/{file-tree-hooks,cache-invalidator}.ts), not core.

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
