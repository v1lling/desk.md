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
import { publishDomainWrite } from "./domain-write-bus";
import { getEditorNotifier } from "./editor-notifier";
import { getContentCache } from "./file-cache";

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

// =============================================================================
// READ OPERATIONS
// =============================================================================

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
  /**
   * Explicit `updated` stamp (ISO datetime) instead of "now". Used by the state refresher to
   * stamp the snapshot with the time the records were READ — stamping write-time would mark
   * records written during the AI call as seen when they weren't.
   */
  updatedStamp?: string;
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
  const fileContent = serializeMarkdown(
    { ...frontmatter, updated: options.updatedStamp ?? nowISO() },
    content
  );
  await getStorage().writeTextFile(filePath, fileContent);
  getContentCache().invalidate(filePath);
  publishDomainWrite({ kind: "write", filePath });
}

/**
 * Save an editor's body into an existing markdown file, preserving its frontmatter.
 *
 * The editor-save funnel: reads the current frontmatter off disk (the on-disk copy wins over
 * whatever the editor session last saw — metadata mutations land there first), stamps
 * `updated`, writes, and publishes on the domain-write bus like every other record write.
 * Returns the full serialized content and the frontmatter it preserved.
 *
 * Throws when the file can't be read: writing anyway would replace the record's frontmatter
 * (title, status, dates) with `{}`. The editor keeps the unsaved text, so aborting loses
 * nothing and the save can be retried.
 */
export async function saveMarkdownBody(
  filePath: string,
  body: string,
): Promise<{ fullContent: string; frontmatter: Record<string, unknown> }> {
  const raw = await getStorage().readTextFile(filePath);
  const frontmatter = parseMarkdown<Record<string, unknown>>(raw).data;

  const stamped = { ...frontmatter, updated: nowISO() };
  const fullContent = serializeMarkdown(stamped, body);
  await getStorage().writeTextFile(filePath, fullContent);
  getContentCache().invalidate(filePath);
  publishDomainWrite({ kind: "update", filePath });

  return { fullContent, frontmatter: stamped };
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
  /** Explicit `updated` stamp (ISO datetime) instead of "now" — see WriteFileOptions. */
  updatedStamp?: string;
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
    const frontmatter = { ...updated.frontmatter, updated: options.updatedStamp ?? nowISO() };
    const fileContent = serializeMarkdown(frontmatter, updated.content);
    await getStorage().writeTextFile(filePath, fileContent);

    getContentCache().invalidate(filePath);
    publishDomainWrite({ kind: "update", filePath });

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
  publishDomainWrite({ kind: "delete", filePath });

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
  publishDomainWrite({ kind: "move", filePath: sourcePath, targetPath });

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

/** Recursively list absolute file paths under a directory. Empty when the dir is missing. */
async function listFilesRecursive(dirPath: string): Promise<string[]> {
  if (!(await getStorage().exists(dirPath))) return [];
  const out: string[] = [];
  const entries = await getStorage().readDir(dirPath);
  for (const entry of entries) {
    const p = await joinPath(dirPath, entry.name);
    if (entry.isDirectory) {
      out.push(...(await listFilesRecursive(p)));
    } else if (entry.isFile) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Move a directory through the funnel. The storage rename stays one atomic op; the contained
 * files are enumerated BEFORE it so each markdown record publishes its own move event —
 * otherwise a folder rename would leave the Smart Index full of dead paths and freshness
 * blind to the change. Caches invalidate and open editors re-point per file, matching
 * `moveMarkdownFile`.
 */
export async function moveDirectoryWithContents(
  sourcePath: string,
  targetPath: string
): Promise<boolean> {
  if (!(await getStorage().exists(sourcePath))) return false;

  const files = await listFilesRecursive(sourcePath);
  await getStorage().rename(sourcePath, targetPath);

  const registry = getEditorNotifier();
  for (const oldPath of files) {
    const newPath = targetPath + oldPath.slice(sourcePath.length);
    getContentCache().invalidate(oldPath);
    getContentCache().invalidate(newPath);
    if (oldPath.endsWith(".md")) {
      publishDomainWrite({ kind: "move", filePath: oldPath, targetPath: newPath });
    }
    if (registry.isOpen(oldPath)) {
      registry.handlePathChange(oldPath, newPath);
    }
    publishPathChange(oldPath, newPath);
  }
  return true;
}

/**
 * Delete a directory through the funnel: per-file delete events for every contained markdown
 * record (see `moveDirectoryWithContents` for why), cache invalidation, and editor
 * deleted-notifications, matching `deleteMarkdownFile`.
 */
export async function removeDirectoryWithContents(dirPath: string): Promise<boolean> {
  if (!(await getStorage().exists(dirPath))) return false;

  const files = await listFilesRecursive(dirPath);
  await getStorage().removeDir(dirPath);

  const registry = getEditorNotifier();
  for (const filePath of files) {
    getContentCache().invalidate(filePath);
    if (filePath.endsWith(".md")) {
      publishDomainWrite({ kind: "delete", filePath });
    }
    if (registry.isOpen(filePath)) {
      registry.handlePathDeleted(filePath);
    }
    publishDeleted(filePath);
  }
  return true;
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
