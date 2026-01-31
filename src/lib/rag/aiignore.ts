/**
 * RAG AI Exclusion Helpers
 *
 * Functions to toggle AI inclusion for files via .aiignore.
 * Used by editor toggles to exclude/include documents from RAG indexing.
 *
 * .aiignore files are stored at workspace level:
 * ~/Desk/workspaces/{workspaceId}/.aiignore
 *
 * Each line in .aiignore is either:
 * - A glob pattern (e.g., *.log, drafts/)
 * - An explicit file path relative to workspace root (e.g., projects/website/docs/draft.md)
 */

import { readTextFile, writeTextFile, isTauri, exists, joinPath } from "@/lib/desk/tauri-fs";
import { getWorkspacePath } from "@/lib/desk/paths";

const AIIGNORE_FILENAME = ".aiignore";

/**
 * Get the .aiignore file path for a workspace
 */
export async function getAIIgnorePath(workspaceId: string): Promise<string> {
  const workspacePath = await getWorkspacePath(workspaceId);
  return joinPath(workspacePath, AIIGNORE_FILENAME);
}

/**
 * Read .aiignore entries for a workspace
 * Returns empty array if file doesn't exist
 */
async function readAIIgnoreEntries(workspaceId: string): Promise<string[]> {
  const aiignorePath = await getAIIgnorePath(workspaceId);

  if (!(await exists(aiignorePath))) {
    return [];
  }

  const content = await readTextFile(aiignorePath);
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

/**
 * Write .aiignore entries for a workspace
 */
async function writeAIIgnoreEntries(
  workspaceId: string,
  entries: string[]
): Promise<void> {
  const aiignorePath = await getAIIgnorePath(workspaceId);

  // Filter out empty entries and deduplicate
  const uniqueEntries = [...new Set(entries.filter((e) => e.trim()))];

  // Add header comment if there are entries
  const content =
    uniqueEntries.length > 0
      ? `# AI Exclusions - files and patterns excluded from RAG indexing\n${uniqueEntries.join("\n")}\n`
      : "";

  await writeTextFile(aiignorePath, content);
}

/**
 * Convert absolute file path to relative path within a workspace.
 * Exported for use by reindex and other RAG modules.
 */
export async function toRelativePath(
  filePath: string,
  workspaceId: string
): Promise<string> {
  const workspacePath = await getWorkspacePath(workspaceId);
  // Normalize both paths to use forward slashes
  const normalizedFile = filePath.replace(/\\/g, "/");
  const normalizedWorkspace = workspacePath.replace(/\\/g, "/");

  if (normalizedFile.startsWith(normalizedWorkspace)) {
    // Remove workspace prefix and leading slash
    return normalizedFile.slice(normalizedWorkspace.length).replace(/^\//, "");
  }

  // If not under workspace, return as-is (shouldn't happen in practice)
  return normalizedFile;
}

/**
 * Check if a file path matches any entry in entries list
 * Supports exact match and basic glob patterns
 */
function matchesEntry(relativePath: string, entry: string): boolean {
  // Exact match
  if (relativePath === entry) {
    return true;
  }

  // Directory match (entry ends with /)
  if (entry.endsWith("/") && relativePath.startsWith(entry)) {
    return true;
  }

  // Simple glob match for extension patterns like *.log
  if (entry.startsWith("*")) {
    const extension = entry.slice(1);
    if (relativePath.endsWith(extension)) {
      return true;
    }
  }

  return false;
}

/**
 * Update AI inclusion state for a file.
 *
 * @param filePath - Absolute path to the file
 * @param workspaceId - The workspace ID (used to locate .aiignore)
 * @param included - true = remove from .aiignore, false = add to .aiignore
 */
export async function setAIInclusion(
  filePath: string,
  workspaceId: string,
  included: boolean
): Promise<void> {
  if (!isTauri()) {
    return; // No-op in browser mode
  }

  const relativePath = await toRelativePath(filePath, workspaceId);
  const entries = await readAIIgnoreEntries(workspaceId);

  if (included) {
    // Remove from .aiignore (include in RAG)
    const filtered = entries.filter((entry) => entry !== relativePath);
    await writeAIIgnoreEntries(workspaceId, filtered);
  } else {
    // Add to .aiignore (exclude from RAG)
    if (!entries.includes(relativePath)) {
      entries.push(relativePath);
      await writeAIIgnoreEntries(workspaceId, entries);
    }
  }
}

/**
 * Check if a file is included in AI indexing.
 *
 * @param filePath - Absolute path to the file
 * @param workspaceId - The workspace ID (used to locate .aiignore)
 * @returns true if included (not in .aiignore), false if excluded
 */
export async function getAIInclusion(
  filePath: string,
  workspaceId: string
): Promise<boolean> {
  if (!isTauri()) {
    return true; // Default to included in browser mode
  }

  try {
    const relativePath = await toRelativePath(filePath, workspaceId);
    const entries = await readAIIgnoreEntries(workspaceId);

    // Check if any entry matches this path
    for (const entry of entries) {
      if (matchesEntry(relativePath, entry)) {
        return false; // Excluded
      }
    }

    return true; // Included (not found in .aiignore)
  } catch {
    // If .aiignore can't be read, default to included
    return true;
  }
}

/**
 * Full AI exclusion state for a file.
 * Used by editors to determine if toggle should be disabled.
 */
export interface AiExclusionState {
  /** Whether the file is excluded from AI indexing */
  isExcluded: boolean;
  /** Whether the file is in an excluded folder (toggle should be disabled) */
  isInExcludedFolder: boolean;
  /** The path of the excluded folder (for UI message) */
  excludedFolderPath?: string;
}

/**
 * Get detailed AI exclusion state for a file.
 * Returns whether excluded and WHY (file itself vs parent folder).
 *
 * @param filePath - Absolute path to the file
 * @param workspaceId - The workspace ID (used to locate .aiignore)
 * @returns AiExclusionState with exclusion details
 */
export async function getAiExclusionState(
  filePath: string,
  workspaceId: string
): Promise<AiExclusionState> {
  if (!isTauri()) {
    return { isExcluded: false, isInExcludedFolder: false };
  }

  try {
    const relativePath = await toRelativePath(filePath, workspaceId);
    const entries = await readAIIgnoreEntries(workspaceId);

    // First check for folder exclusions (higher precedence for UI)
    for (const entry of entries) {
      // Directory match (entry ends with /)
      if (entry.endsWith("/") && relativePath.startsWith(entry)) {
        return {
          isExcluded: true,
          isInExcludedFolder: true,
          excludedFolderPath: entry.slice(0, -1), // Remove trailing slash
        };
      }
    }

    // Check for direct file exclusion
    for (const entry of entries) {
      // Skip folder patterns (already checked)
      if (entry.endsWith("/")) continue;

      // Exact match
      if (relativePath === entry) {
        return { isExcluded: true, isInExcludedFolder: false };
      }

      // Simple glob match for extension patterns like *.log
      if (entry.startsWith("*")) {
        const extension = entry.slice(1);
        if (relativePath.endsWith(extension)) {
          return { isExcluded: true, isInExcludedFolder: false };
        }
      }
    }

    return { isExcluded: false, isInExcludedFolder: false };
  } catch {
    // If .aiignore can't be read, default to included
    return { isExcluded: false, isInExcludedFolder: false };
  }
}

/**
 * Check if a path should be excluded based on .aiignore.
 * Used during indexing to check paths against loaded rules.
 *
 * @param relativePath - Path relative to workspace root
 * @param entries - Pre-loaded .aiignore entries
 * @returns true if the path should be excluded
 */
export function isPathExcludedByAIIgnore(
  relativePath: string,
  entries: string[]
): boolean {
  for (const entry of entries) {
    if (matchesEntry(relativePath, entry)) {
      return true;
    }
  }
  return false;
}

/**
 * Load .aiignore entries for use during indexing.
 * Call this once per workspace and reuse the entries.
 */
export async function loadAIIgnoreEntries(
  workspaceId: string
): Promise<string[]> {
  if (!isTauri()) {
    return [];
  }
  return readAIIgnoreEntries(workspaceId);
}

/**
 * Convert a folder path to the .aiignore pattern format.
 * Folder patterns end with "/" to exclude all files under that folder.
 */
function toFolderPattern(folderPath: string): string {
  // Ensure path ends with /
  const normalizedPath = folderPath.replace(/\\/g, "/");
  return normalizedPath.endsWith("/") ? normalizedPath : `${normalizedPath}/`;
}

/**
 * Update AI inclusion state for a folder.
 * Folders are represented in .aiignore with a trailing slash (e.g., "drafts/").
 *
 * @param folderPath - Relative path to the folder (e.g., "projects/website/drafts")
 * @param workspaceId - The workspace ID (used to locate .aiignore)
 * @param included - true = remove from .aiignore, false = add to .aiignore
 */
export async function setFolderAIInclusion(
  folderPath: string,
  workspaceId: string,
  included: boolean
): Promise<void> {
  if (!isTauri()) {
    return; // No-op in browser mode
  }

  const folderPattern = toFolderPattern(folderPath);
  const entries = await readAIIgnoreEntries(workspaceId);

  if (included) {
    // Remove from .aiignore (include in RAG)
    const filtered = entries.filter((entry) => entry !== folderPattern);
    await writeAIIgnoreEntries(workspaceId, filtered);
  } else {
    // Add to .aiignore (exclude from RAG)
    if (!entries.includes(folderPattern)) {
      entries.push(folderPattern);
      await writeAIIgnoreEntries(workspaceId, entries);
    }
  }
}

/**
 * Check if a folder is included in AI indexing.
 *
 * @param folderPath - Relative path to the folder (e.g., "projects/website/drafts")
 * @param workspaceId - The workspace ID (used to locate .aiignore)
 * @returns true if included (not in .aiignore), false if excluded
 */
export async function getFolderAIInclusion(
  folderPath: string,
  workspaceId: string
): Promise<boolean> {
  if (!isTauri()) {
    return true; // Default to included in browser mode
  }

  try {
    const folderPattern = toFolderPattern(folderPath);
    const entries = await readAIIgnoreEntries(workspaceId);

    // Check for exact folder pattern match
    // Also check if this folder is under an excluded parent folder
    for (const entry of entries) {
      if (entry === folderPattern) {
        return false; // Exact folder pattern match - excluded
      }
      // Check if this folder is under an excluded parent
      if (entry.endsWith("/") && folderPattern.startsWith(entry)) {
        return false; // Under an excluded parent - excluded
      }
    }

    return true; // Included (not found in .aiignore)
  } catch {
    // If .aiignore can't be read, default to included
    return true;
  }
}
