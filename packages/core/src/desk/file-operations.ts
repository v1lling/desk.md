/**
 * Generic File Operations
 *
 * DRY utilities for common markdown file operations.
 * Used by tasks.ts, content.ts, meetings.ts, personal.ts.
 *
 * All write/update/delete/move operations automatically:
 * - Invalidate the content cache (so list views refresh)
 * - Notify open editors via the registry (prevents false "external change" detection)
 */

import { joinPath } from "./env";
import { getStorage } from "./storage";
import { parseMarkdown, serializeMarkdown, filenameToId, nowISO } from "./parser";
import { publishPathChange, publishDeleted } from "./editor-event-bus";
import { getEditorNotifier } from "./editor-notifier";
import { getFileTreeService, getContentCache } from "./file-cache";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of reading a markdown file
 */
export interface ParsedFile<T> {
  id: string;
  filePath: string;
  frontmatter: T;
  content: string;
}

/**
 * Options for reading markdown files from a directory
 */
export interface ReadFilesOptions {
  /** File extension filter (default: ".md") */
  extension?: string;
  /** Use file cache for reading (default: true) */
  useCache?: boolean;
}

// =============================================================================
// READ OPERATIONS
// =============================================================================

/**
 * Read all markdown files from a directory
 *
 * @param dirPath - Absolute path to directory
 * @param options - Optional configuration
 * @returns Array of parsed files with id, filePath, frontmatter, and content
 *
 * @example
 * const files = await readMarkdownFiles<TaskFrontmatter>(tasksPath);
 * const tasks = files.map(f => ({
 *   id: f.id,
 *   ...f.frontmatter,
 *   content: f.content,
 *   filePath: f.filePath,
 * }));
 */
export async function readMarkdownFiles<T>(
  dirPath: string,
  options: ReadFilesOptions = {}
): Promise<ParsedFile<T>[]> {
  const { extension = ".md", useCache = true } = options;

  if (!(await getStorage().exists(dirPath))) {
    return [];
  }

  const entries = await getStorage().readDir(dirPath);
  const results: ParsedFile<T>[] = [];
  const fileTreeService = useCache ? getFileTreeService() : null;

  for (const entry of entries) {
    if (!entry.isFile || !entry.name.endsWith(extension)) {
      continue;
    }

    try {
      const filePath = await joinPath(dirPath, entry.name);

      // Read content (with or without cache)
      let rawContent: string;
      if (fileTreeService) {
        const cached = await fileTreeService.getContentByAbsolutePath<string>(
          filePath,
          (raw) => raw
        );
        if (!cached) {
          console.warn(`[file-ops] No cached content for ${entry.name}`);
          continue;
        }
        rawContent = cached;
      } else {
        rawContent = await getStorage().readTextFile(filePath);
      }

      const { data, content } = parseMarkdown<T>(rawContent);

      results.push({
        id: filenameToId(entry.name),
        filePath,
        frontmatter: data,
        content,
      });
    } catch (e) {
      console.warn(`[file-ops] Failed to read ${entry.name}:`, e);
    }
  }

  return results;
}

/**
 * Read a single markdown file
 *
 * @param filePath - Absolute path to file
 * @returns Parsed file or null if not found
 */
export async function readMarkdownFile<T>(
  filePath: string
): Promise<ParsedFile<T> | null> {
  if (!(await getStorage().exists(filePath))) {
    return null;
  }

  try {
    const content = await getStorage().readTextFile(filePath);
    const { data, content: body } = parseMarkdown<T>(content);
    const filename = filePath.split("/").pop() || "";

    return {
      id: filenameToId(filename),
      filePath,
      frontmatter: data,
      content: body,
    };
  } catch (e) {
    console.warn(`[file-ops] Failed to read file:`, e);
    return null;
  }
}

// =============================================================================
// WRITE OPERATIONS
// =============================================================================

/**
 * Options for writing a markdown file
 */
export interface WriteFileOptions {
  /** Create parent directories if they don't exist (default: true) */
  createDir?: boolean;
}

/**
 * Write a markdown file with frontmatter
 *
 * @param filePath - Absolute path to file
 * @param frontmatter - YAML frontmatter data
 * @param content - Markdown body content
 * @param options - Optional configuration
 */
export async function writeMarkdownFile<T extends Record<string, unknown>>(
  filePath: string,
  frontmatter: T,
  content: string,
  options: WriteFileOptions = {}
): Promise<void> {
  const { createDir = true } = options;

  if (createDir) {
    const parts = filePath.split("/");
    parts.pop();
    const dirPath = parts.join("/");
    await getStorage().mkdir(dirPath);
  }

  // Every caller writes a content file (task/doc/meeting/capture) — workspace.md
  // and project.md are written elsewhere — so the `updated` stamp is unconditional.
  const fileContent = serializeMarkdown({ ...frontmatter, updated: nowISO() }, content);
  await getStorage().writeTextFile(filePath, fileContent);
  getContentCache().invalidate(filePath);
}

/**
 * Result of updating a markdown file
 */
export interface UpdateResult<T> {
  frontmatter: T;
  content: string;
  filePath: string;
}

/**
 * Options for updating a markdown file
 */
export interface UpdateFileOptions {
  /** Notify open editors about the update (default: true) */
  notifyEditors?: boolean;
}

/**
 * Update a markdown file's frontmatter and/or content
 *
 * Automatically invalidates cache and notifies open editors.
 *
 * @param filePath - Absolute path to file
 * @param updater - Function that receives current frontmatter and content, returns updated values
 * @returns Update result with frontmatter, content, and filePath; or null if file not found
 *
 * @example
 * await updateMarkdownFile<TaskFrontmatter>(filePath, (fm, content) => ({
 *   frontmatter: { ...fm, status: "done" },
 *   content,
 * }));
 */
export async function updateMarkdownFile<T extends Record<string, unknown>>(
  filePath: string,
  updater: (frontmatter: T, content: string) => { frontmatter: T; content: string },
  options: UpdateFileOptions = {}
): Promise<UpdateResult<T> | null> {
  const { notifyEditors = true } = options;

  if (!(await getStorage().exists(filePath))) {
    return null;
  }

  try {
    const rawContent = await getStorage().readTextFile(filePath);
    const { data, content } = parseMarkdown<T>(rawContent);

    const updated = updater(data, content);
    // Stamp after the updater so it can't be overwritten with a stale value.
    const frontmatter = { ...updated.frontmatter, updated: nowISO() };
    const fileContent = serializeMarkdown(frontmatter, updated.content);
    await getStorage().writeTextFile(filePath, fileContent);

    getContentCache().invalidate(filePath);

    if (notifyEditors) {
      const registry = getEditorNotifier();
      if (registry.isOpen(filePath)) {
        registry.updateLastSaved(filePath, updated.content);
      }
    }

    return {
      frontmatter,
      content: updated.content,
      filePath,
    };
  } catch (e) {
    console.warn(`[file-ops] Failed to update file:`, e);
    return null;
  }
}

// =============================================================================
// DELETE OPERATIONS
// =============================================================================

/**
 * Options for deleting a file
 */
export interface DeleteFileOptions {
  /** Notify open editors about deletion (default: true) */
  notifyEditors?: boolean;
}

/**
 * Delete a markdown file
 *
 * Automatically invalidates cache and notifies open editors.
 *
 * @param filePath - Absolute path to file
 * @param options - Optional configuration
 * @returns true if deleted, false if not found
 */
export async function deleteMarkdownFile(
  filePath: string,
  options: DeleteFileOptions = {}
): Promise<boolean> {
  const { notifyEditors = true } = options;

  if (!(await getStorage().exists(filePath))) {
    return false;
  }

  await getStorage().removeFile(filePath);
  getContentCache().invalidate(filePath);

  if (notifyEditors) {
    const registry = getEditorNotifier();
    if (registry.isOpen(filePath)) {
      registry.handlePathDeleted(filePath);
    }
    publishDeleted(filePath);
  }

  return true;
}

// =============================================================================
// MOVE OPERATIONS
// =============================================================================

/**
 * Options for moving a file
 */
export interface MoveFileOptions {
  /** Create target directory if it doesn't exist (default: true) */
  createDir?: boolean;
  /** Notify open editors about the move (default: true) */
  notifyEditors?: boolean;
}

/**
 * Move a markdown file to a new location
 *
 * Automatically invalidates cache and notifies open editors.
 *
 * @param sourcePath - Current absolute path
 * @param targetPath - New absolute path
 * @param options - Optional configuration
 * @returns true if moved, false if source not found
 */
export async function moveMarkdownFile(
  sourcePath: string,
  targetPath: string,
  options: MoveFileOptions = {}
): Promise<boolean> {
  const { createDir = true, notifyEditors = true } = options;

  if (!(await getStorage().exists(sourcePath))) {
    return false;
  }

  if (createDir) {
    const parts = targetPath.split("/");
    parts.pop();
    const dirPath = parts.join("/");
    await getStorage().mkdir(dirPath);
  }

  await getStorage().rename(sourcePath, targetPath);

  getContentCache().invalidate(sourcePath);
  getContentCache().invalidate(targetPath);

  if (notifyEditors) {
    const registry = getEditorNotifier();
    if (registry.isOpen(sourcePath)) {
      registry.handlePathChange(sourcePath, targetPath);
    }
    publishPathChange(sourcePath, targetPath);
  }

  return true;
}

// =============================================================================
// DIRECTORY OPERATIONS
// =============================================================================

/**
 * Ensure a directory exists
 *
 * @param dirPath - Absolute path to directory
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await getStorage().mkdir(dirPath);
}

/**
 * Check if a directory has any markdown files
 *
 * @param dirPath - Absolute path to directory
 * @param extension - File extension to check (default: ".md")
 */
export async function hasMarkdownFiles(
  dirPath: string,
  extension: string = ".md"
): Promise<boolean> {
  if (!(await getStorage().exists(dirPath))) {
    return false;
  }

  const entries = await getStorage().readDir(dirPath);
  return entries.some((e) => e.isFile && e.name.endsWith(extension));
}

/**
 * List subdirectories in a directory
 * Excludes hidden directories (starting with .)
 *
 * @param dirPath - Absolute path to directory
 * @returns Array of directory names
 */
export async function listSubdirectories(dirPath: string): Promise<string[]> {
  if (!(await getStorage().exists(dirPath))) {
    return [];
  }

  const entries = await getStorage().readDir(dirPath);
  return entries
    .filter((e) => e.isDirectory && !e.name.startsWith("."))
    .map((e) => e.name);
}

// =============================================================================
// SEARCH HELPERS
// =============================================================================

/**
 * Find a file by ID in a directory
 *
 * @param dirPath - Absolute path to directory
 * @param id - File ID (filename without extension)
 * @param extension - File extension (default: ".md")
 * @returns Full file path or null if not found
 */
export async function findFileById(
  dirPath: string,
  id: string,
  extension: string = ".md"
): Promise<string | null> {
  if (!(await getStorage().exists(dirPath))) {
    return null;
  }

  const entries = await getStorage().readDir(dirPath);
  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(extension)) {
      if (filenameToId(entry.name) === id) {
        return joinPath(dirPath, entry.name);
      }
    }
  }

  return null;
}

// =============================================================================
// COMPOUND OPERATIONS
// =============================================================================

/**
 * Find a file by ID in a directory and update it
 *
 * Combines findFileById + updateMarkdownFile — the most common pattern
 * in domain files (tasks, meetings, docs).
 *
 * @param dirPath - Absolute path to directory containing the file
 * @param id - File ID (filename without extension)
 * @param updater - Function that receives current frontmatter and content, returns updated values
 * @param options - Optional configuration
 * @returns Update result or null if not found
 */
export async function findAndUpdateFile<T extends Record<string, unknown>>(
  dirPath: string,
  id: string,
  updater: (frontmatter: T, content: string) => { frontmatter: T; content: string },
  options?: UpdateFileOptions
): Promise<UpdateResult<T> | null> {
  const filePath = await findFileById(dirPath, id);
  if (!filePath) return null;
  return updateMarkdownFile<T>(filePath, updater, options);
}

/**
 * Find a file by ID in a directory and delete it
 *
 * Combines findFileById + deleteMarkdownFile.
 *
 * @param dirPath - Absolute path to directory containing the file
 * @param id - File ID (filename without extension)
 * @param options - Optional configuration
 * @returns The deleted file's path, or null if not found
 */
export async function findAndDeleteFile(
  dirPath: string,
  id: string,
  options?: DeleteFileOptions
): Promise<string | null> {
  const filePath = await findFileById(dirPath, id);
  if (!filePath) return null;
  const deleted = await deleteMarkdownFile(filePath, options);
  return deleted ? filePath : null;
}
