/**
 * .aiignore — per-workspace AI exclusions (gitignore-flavoured patterns).
 *
 * This lives in the domain layer so enforcement runs *where the data is read*:
 * the in-app assistant (via DeskService) and a future MCP server both honour the
 * correct workspace's `.aiignore`, against whichever disk the domain runs on.
 *
 * Stored at the workspace root: `{workspace}/.aiignore`. Each non-comment line is
 * an exact workspace-relative path, a `folder/` prefix, or a `*.ext` suffix glob.
 *
 * Paths passed in may be absolute (a file's `filePath`, always produced by the
 * SAME side that runs this code — local in local mode, the server in hosted mode)
 * or already workspace-relative (folder patterns); `toRelativePath` normalises the
 * former and leaves the latter untouched.
 */
import { isMockMode, joinPath } from "./env";
import { getStorage } from "./storage";
import { getWorkspacePath } from "./paths";

const AIIGNORE_FILENAME = ".aiignore";

async function getAIIgnorePath(workspaceId: string): Promise<string> {
  const workspacePath = await getWorkspacePath(workspaceId);
  return joinPath(workspacePath, AIIGNORE_FILENAME);
}

async function readAIIgnoreEntries(workspaceId: string): Promise<string[]> {
  const aiignorePath = await getAIIgnorePath(workspaceId);
  if (!(await getStorage().exists(aiignorePath))) {
    return [];
  }
  const content = await getStorage().readTextFile(aiignorePath);
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

async function writeAIIgnoreEntries(workspaceId: string, entries: string[]): Promise<void> {
  const aiignorePath = await getAIIgnorePath(workspaceId);
  const uniqueEntries = [...new Set(entries.filter((e) => e.trim()))];
  const content =
    uniqueEntries.length > 0
      ? `# AI Exclusions - files and patterns excluded from AI indexing\n${uniqueEntries.join("\n")}\n`
      : "";
  await getStorage().writeTextFile(aiignorePath, content);
}

/** Convert an absolute file path to a workspace-relative path (no-op if already relative). */
export async function toRelativePath(filePath: string, workspaceId: string): Promise<string> {
  const workspacePath = await getWorkspacePath(workspaceId);
  const normalizedFile = filePath.replace(/\\/g, "/");
  const normalizedWorkspace = workspacePath.replace(/\\/g, "/");
  if (normalizedFile.startsWith(normalizedWorkspace)) {
    return normalizedFile.slice(normalizedWorkspace.length).replace(/^\//, "");
  }
  return normalizedFile;
}

/** Exact match, `folder/` directory prefix, or `*.ext` suffix glob. */
function matchesEntry(relativePath: string, entry: string): boolean {
  if (relativePath === entry) return true;
  if (entry.endsWith("/") && relativePath.startsWith(entry)) return true;
  if (entry.startsWith("*")) {
    const extension = entry.slice(1);
    if (relativePath.endsWith(extension)) return true;
  }
  return false;
}

/** Pure: is a workspace-relative path excluded by the given pre-loaded entries? */
export function isPathExcludedByAIIgnore(relativePath: string, entries: string[]): boolean {
  for (const entry of entries) {
    if (matchesEntry(relativePath, entry)) return true;
  }
  return false;
}

/** Load `.aiignore` entries for a workspace (empty in mock mode / when absent). */
export async function loadAIIgnoreEntries(workspaceId: string): Promise<string[]> {
  if (isMockMode()) return [];
  return readAIIgnoreEntries(workspaceId);
}

/**
 * Toggle a file's AI inclusion. `included=true` removes it from `.aiignore`,
 * `false` adds it. `filePath` may be absolute or workspace-relative.
 */
export async function setAIInclusion(
  filePath: string,
  workspaceId: string,
  included: boolean
): Promise<void> {
  if (isMockMode()) return;
  const relativePath = await toRelativePath(filePath, workspaceId);
  const entries = await readAIIgnoreEntries(workspaceId);
  if (included) {
    await writeAIIgnoreEntries(workspaceId, entries.filter((entry) => entry !== relativePath));
  } else if (!entries.includes(relativePath)) {
    entries.push(relativePath);
    await writeAIIgnoreEntries(workspaceId, entries);
  }
}

/** True if the file is included (not excluded by `.aiignore`). */
export async function getAIInclusion(filePath: string, workspaceId: string): Promise<boolean> {
  if (isMockMode()) return true;
  try {
    const relativePath = await toRelativePath(filePath, workspaceId);
    const entries = await readAIIgnoreEntries(workspaceId);
    return !isPathExcludedByAIIgnore(relativePath, entries);
  } catch {
    return true;
  }
}

/** Full AI exclusion state for a file — whether excluded and WHY (file vs parent folder). */
export interface AiExclusionState {
  isExcluded: boolean;
  isInExcludedFolder: boolean;
  excludedFolderPath?: string;
}

export async function getAiExclusionState(
  filePath: string,
  workspaceId: string
): Promise<AiExclusionState> {
  if (isMockMode()) return { isExcluded: false, isInExcludedFolder: false };
  try {
    const relativePath = await toRelativePath(filePath, workspaceId);
    const entries = await readAIIgnoreEntries(workspaceId);

    // Folder exclusions take precedence (the toggle is disabled for them in the UI).
    for (const entry of entries) {
      if (entry.endsWith("/") && relativePath.startsWith(entry)) {
        return {
          isExcluded: true,
          isInExcludedFolder: true,
          excludedFolderPath: entry.slice(0, -1),
        };
      }
    }
    for (const entry of entries) {
      if (entry.endsWith("/")) continue;
      if (relativePath === entry) return { isExcluded: true, isInExcludedFolder: false };
      if (entry.startsWith("*")) {
        const extension = entry.slice(1);
        if (relativePath.endsWith(extension)) return { isExcluded: true, isInExcludedFolder: false };
      }
    }
    return { isExcluded: false, isInExcludedFolder: false };
  } catch {
    return { isExcluded: false, isInExcludedFolder: false };
  }
}

/** Ensure a workspace-relative folder path is in `dir/` pattern form. */
function toFolderPattern(folderPath: string): string {
  const normalizedPath = folderPath.replace(/\\/g, "/");
  return normalizedPath.endsWith("/") ? normalizedPath : `${normalizedPath}/`;
}

/** Toggle a folder's AI inclusion (stored as a trailing-slash pattern). */
export async function setFolderAIInclusion(
  folderPath: string,
  workspaceId: string,
  included: boolean
): Promise<void> {
  if (isMockMode()) return;
  const folderPattern = toFolderPattern(folderPath);
  const entries = await readAIIgnoreEntries(workspaceId);
  if (included) {
    await writeAIIgnoreEntries(workspaceId, entries.filter((entry) => entry !== folderPattern));
  } else if (!entries.includes(folderPattern)) {
    entries.push(folderPattern);
    await writeAIIgnoreEntries(workspaceId, entries);
  }
}

/** True if the folder is included (not itself excluded and not under an excluded parent). */
export async function getFolderAIInclusion(folderPath: string, workspaceId: string): Promise<boolean> {
  if (isMockMode()) return true;
  try {
    const folderPattern = toFolderPattern(folderPath);
    const entries = await readAIIgnoreEntries(workspaceId);
    for (const entry of entries) {
      if (entry === folderPattern) return false;
      if (entry.endsWith("/") && folderPattern.startsWith(entry)) return false;
    }
    return true;
  } catch {
    return true;
  }
}
