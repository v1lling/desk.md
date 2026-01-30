/**
 * Tree Builder
 *
 * Builds TreeNode structures from the file system.
 * Handles directory traversal and metadata extraction.
 */

import type { TreeNode, TraversalOptions } from "./types";
import {
  isTauri,
  getDeskPath,
  readDir,
  joinPath,
  exists,
} from "../tauri-fs";

/**
 * Default traversal options
 */
const DEFAULT_OPTIONS: Required<TraversalOptions> = {
  maxDepth: Infinity,
  extensions: [],
  includeHidden: false,
  excludeFolders: [".git", "node_modules", ".DS_Store"],
};

/**
 * Get file extension from filename
 */
function getExtension(filename: string): string | undefined {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === 0) return undefined;
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Check if a file should be included based on options
 */
function shouldIncludeFile(name: string, options: Required<TraversalOptions>): boolean {
  // Check hidden
  if (!options.includeHidden && name.startsWith(".")) {
    return false;
  }

  // Check extension filter
  if (options.extensions.length > 0) {
    const ext = getExtension(name);
    if (!ext || !options.extensions.includes(ext)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a directory should be traversed based on options
 */
function shouldIncludeDirectory(name: string, options: Required<TraversalOptions>): boolean {
  // Check hidden
  if (!options.includeHidden && name.startsWith(".")) {
    return false;
  }

  // Check excluded folders
  if (options.excludeFolders.includes(name)) {
    return false;
  }

  return true;
}

/**
 * Build a tree node for a file
 */
function buildFileNode(
  absolutePath: string,
  relativePath: string,
  name: string
): TreeNode {
  return {
    path: absolutePath,
    relativePath,
    name,
    type: "file",
    extension: getExtension(name),
    // Note: size and mtime would require additional fs calls
    // We'll add them when needed for caching
  };
}

/**
 * Build a tree node for a directory
 */
function buildDirectoryNode(
  absolutePath: string,
  relativePath: string,
  name: string,
  children?: TreeNode[]
): TreeNode {
  return {
    path: absolutePath,
    relativePath,
    name,
    type: "directory",
    children,
    childrenLoaded: children !== undefined,
  };
}

/**
 * Build a tree from a directory path
 *
 * @param basePath - Absolute path to start from (usually Desk root)
 * @param relativePath - Relative path from basePath (empty string for root)
 * @param options - Traversal options
 * @param currentDepth - Current recursion depth
 */
export async function buildTree(
  basePath: string,
  relativePath: string = "",
  options: TraversalOptions = {},
  currentDepth: number = 0
): Promise<TreeNode[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Check depth limit
  if (currentDepth >= opts.maxDepth) {
    return [];
  }

  const currentPath = relativePath
    ? await joinPath(basePath, relativePath)
    : basePath;

  // Check if path exists
  if (!(await exists(currentPath))) {
    return [];
  }

  // Read directory entries
  const entries = await readDir(currentPath);
  const nodes: TreeNode[] = [];

  // Separate and sort directories and files
  const directories = entries
    .filter((e) => e.isDirectory && shouldIncludeDirectory(e.name, opts))
    .sort((a, b) => a.name.localeCompare(b.name));

  const files = entries
    .filter((e) => e.isFile && shouldIncludeFile(e.name, opts))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Process directories first (for consistent ordering)
  for (const dir of directories) {
    const dirRelativePath = relativePath ? `${relativePath}/${dir.name}` : dir.name;
    const dirAbsolutePath = await joinPath(currentPath, dir.name);

    // Recursively build children
    const children = await buildTree(basePath, dirRelativePath, options, currentDepth + 1);

    nodes.push(buildDirectoryNode(dirAbsolutePath, dirRelativePath, dir.name, children));
  }

  // Process files
  for (const file of files) {
    const fileRelativePath = relativePath ? `${relativePath}/${file.name}` : file.name;
    const fileAbsolutePath = await joinPath(currentPath, file.name);

    nodes.push(buildFileNode(fileAbsolutePath, fileRelativePath, file.name));
  }

  return nodes;
}

/**
 * Build a single tree node (without children for directories)
 * Useful for getting metadata about a specific path
 */
export async function buildNode(
  basePath: string,
  relativePath: string
): Promise<TreeNode | null> {
  if (!relativePath) {
    // Root node
    return buildDirectoryNode(basePath, "", "Desk", undefined);
  }

  const absolutePath = await joinPath(basePath, relativePath);

  if (!(await exists(absolutePath))) {
    return null;
  }

  const name = relativePath.split("/").pop() || relativePath;

  // Check if it's a directory by trying to read it
  try {
    await readDir(absolutePath);
    // It's a directory
    return buildDirectoryNode(absolutePath, relativePath, name, undefined);
  } catch {
    // It's a file
    return buildFileNode(absolutePath, relativePath, name);
  }
}

/**
 * Get the Desk root path (convenience wrapper)
 */
export async function getDeskRoot(): Promise<string> {
  return getDeskPath();
}

/**
 * Check if we're in Tauri environment
 */
export function isFileSystemAvailable(): boolean {
  return isTauri();
}
