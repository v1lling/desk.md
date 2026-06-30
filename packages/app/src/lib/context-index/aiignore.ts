/**
 * App-side `.aiignore` shim.
 *
 * The logic now lives in `@desk/core` (so the Smart Index and the MCP server
 * enforce the same rules against the right disk). These wrappers route the
 * management ops through `getDeskService()`, so in hosted mode the UI toggles and
 * index reads operate on the **server's** `.aiignore`, not the local machine.
 *
 * The pure matcher (`isPathExcludedByAIIgnore`) and the `AiExclusionState` type are
 * re-exported straight from core.
 */
import { getDeskService } from "@desk/core";

export { isPathExcludedByAIIgnore } from "@desk/core";
export type { AiExclusionState } from "@desk/core";

export function loadAIIgnoreEntries(workspaceId: string): Promise<string[]> {
  return getDeskService().loadAIIgnoreEntries(workspaceId);
}

export function getAIInclusion(filePath: string, workspaceId: string): Promise<boolean> {
  return getDeskService().getAIInclusion(filePath, workspaceId);
}

export function setAIInclusion(
  filePath: string,
  workspaceId: string,
  included: boolean
): Promise<void> {
  return getDeskService().setAIInclusion(filePath, workspaceId, included);
}

export function getAiExclusionState(filePath: string, workspaceId: string) {
  return getDeskService().getAiExclusionState(filePath, workspaceId);
}

export function getFolderAIInclusion(folderPath: string, workspaceId: string): Promise<boolean> {
  return getDeskService().getFolderAIInclusion(folderPath, workspaceId);
}

export function setFolderAIInclusion(
  folderPath: string,
  workspaceId: string,
  included: boolean
): Promise<void> {
  return getDeskService().setFolderAIInclusion(folderPath, workspaceId, included);
}
