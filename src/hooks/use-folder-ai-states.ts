/**
 * Hook to manage AI inclusion states for folders in a content tree.
 * Reads/writes .aiignore files to control which folders are indexed.
 */

import { useState, useEffect, useCallback } from "react";
import { getFolderAIInclusion, setFolderAIInclusion } from "@/lib/context-index/aiignore";
import { PERSONAL_WORKSPACE_ID } from "@/lib/desk/constants";
import { isTauri } from "@/lib/desk/tauri-fs";
import type { ContentScope } from "@/types";

/**
 * Convert a content-relative folder path to a workspace-relative path.
 * Content tree uses paths relative to the content base (e.g., "drafts"),
 * but .aiignore stores paths relative to workspace root (e.g., "projects/website/docs/drafts").
 */
function toWorkspaceRelativePath(
  contentRelativePath: string,
  scope: ContentScope,
  projectId?: string
): string {
  if (scope === "personal" || scope === "workspace") {
    return `docs/${contentRelativePath}`;
  }
  if (projectId) {
    return `projects/${projectId}/docs/${contentRelativePath}`;
  }
  return contentRelativePath;
}

/**
 * Hook to manage AI inclusion states for folders in a content tree
 *
 * @param folderPaths - Array of folder paths to track (content-relative)
 * @param workspaceId - The workspace ID (required for non-personal scopes)
 * @param scope - The content scope
 * @param projectId - The project ID (required for project scope)
 * @returns Object with folderAIStates map and toggleFolderAI function
 */
export function useFolderAIStates(
  folderPaths: string[],
  workspaceId: string | null | undefined,
  scope: ContentScope,
  projectId?: string | null
) {
  const [folderAIStates, setFolderAIStates] = useState<Map<string, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const effectiveWorkspaceId = workspaceId || (scope === "personal" ? PERSONAL_WORKSPACE_ID : null);

  useEffect(() => {
    if (!effectiveWorkspaceId || !isTauri() || folderPaths.length === 0) {
      const defaultStates = new Map<string, boolean>();
      folderPaths.forEach(path => defaultStates.set(path, true));
      setFolderAIStates(defaultStates);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    async function loadStates() {
      const states = new Map<string, boolean>();

      await Promise.all(
        folderPaths.map(async (contentPath) => {
          try {
            const wsRelativePath = toWorkspaceRelativePath(contentPath, scope, projectId || undefined);
            const isIncluded = await getFolderAIInclusion(wsRelativePath, effectiveWorkspaceId!);
            if (!cancelled) {
              states.set(contentPath, isIncluded);
            }
          } catch (error) {
            console.error(`Failed to get AI inclusion for folder ${contentPath}:`, error);
            states.set(contentPath, true);
          }
        })
      );

      if (!cancelled) {
        setFolderAIStates(states);
        setIsLoading(false);
      }
    }

    loadStates();

    return () => {
      cancelled = true;
    };
  }, [folderPaths.join(","), effectiveWorkspaceId, scope, projectId]);

  const toggleFolderAI = useCallback(
    async (folderPath: string, currentlyIncluded: boolean) => {
      if (!effectiveWorkspaceId) return;

      const wsRelativePath = toWorkspaceRelativePath(folderPath, scope, projectId || undefined);

      try {
        setFolderAIStates((prev) => {
          const next = new Map(prev);
          next.set(folderPath, !currentlyIncluded);
          return next;
        });

        await setFolderAIInclusion(wsRelativePath, effectiveWorkspaceId, !currentlyIncluded);
      } catch (error) {
        console.error(`Failed to toggle AI inclusion for folder ${folderPath}:`, error);
        setFolderAIStates((prev) => {
          const next = new Map(prev);
          next.set(folderPath, currentlyIncluded);
          return next;
        });
      }
    },
    [effectiveWorkspaceId, scope, projectId]
  );

  return {
    folderAIStates,
    toggleFolderAI,
    isLoading,
  };
}
