/**
 * useQueryInvalidator Hook
 *
 * Routes file system events to the appropriate handler:
 * - Open files → Editor update (via event bus)
 * - Closed files → TanStack Query invalidation
 *
 * This hook replaces the old useFileWatcher and adds awareness
 * of which files are currently open in editors.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  startWatching,
  stopWatching,
  onFileChange,
  type WatchEvent,
} from "@/lib/desk-watcher";
import {
  getItemTypeFromPath,
  getWorkspaceIdFromPath,
  getProjectIdFromPath,
  isCapturePath,
} from "@desk/core";
import {
  taskKeys,
  contentKeys,
  meetingKeys,
  projectKeys,
  workspaceKeys,
  viewStateKeys,
  captureKeys,
} from "@/stores";
import { getFileTreeService, getContentCache } from "@desk/core";
import { connectToWatcher, disconnectFromWatcher } from "@/lib/cache-invalidator";
import { fileTreeKeys } from "@/lib/file-tree-hooks";
import {
  useOpenEditorRegistry,
  type EditorSession,
} from "@/stores/open-editor-registry";
import { publishContentUpdate, publishDeleted } from "@desk/core";
import { getStorage } from "@desk/core";
import { parseMarkdown } from "@desk/core";
import { isLocalDisk } from "@/lib/connection";
import { notifyExternalChanges } from "@desk/core";

/**
 * Hook to initialize file watching and route events
 * Call this once in your app root (e.g., layout.tsx or providers)
 */
export function useQueryInvalidator() {
  const queryClient = useQueryClient();
  const isInitialized = useRef(false);

  useEffect(() => {
    // The file watcher + tree-service cache are a LOCAL-disk subsystem: they read
    // the filesystem directly. In remote mode the domain is on the server (and the
    // guard provider blocks getStorage()), so the whole watcher is skipped — list
    // refresh after writes is driven by query invalidation instead.
    if (!isLocalDisk()) return;

    // Prevent double initialization in strict mode
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Initialize file tree service first
    const fileTreeService = getFileTreeService();
    fileTreeService.initialize().then(() => {
      // Connect file tree service to watcher
      connectToWatcher();
    });

    // Start the watcher
    startWatching();

    // Subscribe to file changes
    const unsubscribe = onFileChange(async (event: WatchEvent) => {
      await handleFileChange(event, queryClient);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
      disconnectFromWatcher();
      stopWatching();
      isInitialized.current = false;
    };
  }, [queryClient]);
}

/**
 * Handle file change events
 * Routes to either editor update or query invalidation based on whether file is open
 */
async function handleFileChange(
  event: WatchEvent,
  queryClient: ReturnType<typeof useQueryClient>
) {
  const registry = useOpenEditorRegistry.getState();

  // First pass: sync any open editors for the changed paths (reads the file and
  // pushes external edits into the editor / handles deletes).
  for (const path of event.paths) {
    const session = registry.getSession(path);
    if (session) {
      await handleOpenFileChange(path, session, event.kind);
    }
  }

  // Then clear file caches and invalidate queries for the changed paths so closed
  // views refetch. (Editor-handled paths are synced above; the extra background
  // list refetch here is harmless and keeps list views consistent.)
  invalidateQueriesForPaths(event.paths, queryClient);

  // Feed the change into the maintenance engine (core desk/maintenance). The engine gets the
  // app's own writes from the domain-write bus already; this covers EXTERNAL edits — an agent
  // or script writing into the folder gets the same index update + state refresh. The double
  // arrival of our own writes is absorbed by the engine's debounces.
  notifyExternalChanges(event.paths, event.kind === "remove" ? "remove" : "modify");
}

/**
 * Clear the file caches for the given paths and invalidate every TanStack query
 * affected by them. Driven by the file-watcher path (handleFileChange).
 *
 * The cache clear always runs BEFORE the query invalidation so refetches can't
 * serve stale cached content.
 */
export function invalidateQueriesForPaths(
  paths: string[],
  queryClient: ReturnType<typeof useQueryClient>
): void {
  const contentCache = getContentCache();
  const fileTreeService = getFileTreeService();
  for (const path of paths) {
    contentCache.invalidate(path);
    contentCache.invalidatePrefix(path + "/");
  }
  fileTreeService.clearCache();

  const affectedWorkspaces = new Set<string>();
  const affectedProjects = new Map<string, Set<string>>(); // workspaceId -> Set<projectId>
  const affectedTypes = new Set<string>();
  let hasCaptureChanges = false;

  for (const path of paths) {
    const itemType = getItemTypeFromPath(path);
    const workspaceId = getWorkspaceIdFromPath(path);
    const projectId = getProjectIdFromPath(path);

    affectedTypes.add(itemType);
    if (workspaceId) {
      affectedWorkspaces.add(workspaceId);
      if (projectId) {
        if (!affectedProjects.has(workspaceId)) {
          affectedProjects.set(workspaceId, new Set());
        }
        affectedProjects.get(workspaceId)!.add(projectId);
      }
    }
    if (isCapturePath(path)) {
      hasCaptureChanges = true;
    }
  }

  invalidateQueriesForChanges(
    affectedTypes,
    affectedWorkspaces,
    affectedProjects,
    hasCaptureChanges,
    queryClient
  );

  // Also invalidate file-tree queries for any file change.
  queryClient.invalidateQueries({
    queryKey: fileTreeKeys.all,
  });
}

/**
 * Handle a file change for an open file
 * Returns true if the change was handled (external change detected)
 */
async function handleOpenFileChange(
  path: string,
  session: EditorSession,
  eventKind: WatchEvent["kind"]
): Promise<boolean> {
  // For remove events, the file is gone - mark as deleted and notify editor
  if (eventKind === "remove") {
    useOpenEditorRegistry.getState().handlePathDeleted(path);
    publishDeleted(path);
    return true;
  }

  // For "any" events (batched), check if file still exists
  // This handles cases where remove got merged with other events
  if (eventKind === "any") {
    const fileExists = await getStorage().exists(path);
    if (!fileExists) {
      useOpenEditorRegistry.getState().handlePathDeleted(path);
      publishDeleted(path);
      return true;
    }
  }

  try {
    const fileContent = await getStorage().readTextFile(path);

    // Parse to extract body for comparison (registry stores body only, not full file with frontmatter)
    const { content: fileBody } = parseMarkdown<Record<string, unknown>>(fileContent);

    // Body matches what we last saved → our save event, ignore
    // Note: gray-matter's stringify/parse roundtrip may add/remove leading/trailing
    // newlines, so we trim both sides for comparison
    if (fileBody.trim() === session.lastSavedContent.trim()) {
      return true; // Handled (it was our own save)
    }

    // External change → update editor via event bus
    publishContentUpdate(path, fileContent); // Publish full file (handler parses it)

    // Update lastSavedContent in registry with body (not full file) to maintain consistency
    useOpenEditorRegistry.getState().updateLastSaved(path, fileBody);

    return true;
  } catch (error) {
    // File might have been deleted or moved
    // Check error message (Tauri errors may not be instanceof Error)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("not found") ||
      errorMessage.includes("No such file") ||
      errorMessage.includes("os error 2")
    ) {
      useOpenEditorRegistry.getState().handlePathDeleted(path);
      publishDeleted(path);
      return true;
    }
    console.error(`[query-invalidator] Error reading file: ${path}`, error);
    return false;
  }
}

/**
 * Invalidate TanStack Query caches based on what changed
 */
function invalidateQueriesForChanges(
  affectedTypes: Set<string>,
  affectedWorkspaces: Set<string>,
  affectedProjects: Map<string, Set<string>>,
  hasCaptureChanges: boolean,
  queryClient: ReturnType<typeof useQueryClient>
) {
  for (const itemType of affectedTypes) {
    switch (itemType) {
      case "task":
        // Invalidate tasks for affected workspaces
        for (const workspaceId of affectedWorkspaces) {
          queryClient.invalidateQueries({
            queryKey: taskKeys.byWorkspace(workspaceId),
          });
        }
        // Personal tasks
        if (hasCaptureChanges) {
          queryClient.invalidateQueries({
            queryKey: captureKeys.all,
          });
        }
        // Also invalidate view state (task ordering)
        queryClient.invalidateQueries({
          queryKey: viewStateKeys.all,
        });
        break;

      case "doc":
        // Invalidate doc queries for affected workspaces
        for (const workspaceId of affectedWorkspaces) {
          // Flat doc list
          queryClient.invalidateQueries({
            queryKey: contentKeys.byWorkspace(workspaceId),
          });
          // Workspace-level doc tree
          queryClient.invalidateQueries({
            queryKey: contentKeys.tree("workspace", workspaceId, undefined),
          });
          // Project-level doc trees
          const projects = affectedProjects.get(workspaceId);
          if (projects) {
            for (const projectId of projects) {
              queryClient.invalidateQueries({
                queryKey: contentKeys.tree("project", workspaceId, projectId),
              });
            }
          }
        }
        break;

      case "meeting":
        for (const workspaceId of affectedWorkspaces) {
          queryClient.invalidateQueries({
            queryKey: meetingKeys.byWorkspace(workspaceId),
          });
        }
        break;

      case "context":
        // Context files (workspace- and project-level). Before this case existed they fell
        // into "unknown", so an external context edit never refreshed the context tree the
        // panel reads — and the background state write needs this to show up.
        for (const workspaceId of affectedWorkspaces) {
          queryClient.invalidateQueries({
            queryKey: contentKeys.tree("workspace", workspaceId, undefined, "context"),
          });
          queryClient.invalidateQueries({ queryKey: contentKeys.mergedOverview(workspaceId) });
          const projects = affectedProjects.get(workspaceId);
          if (projects) {
            for (const projectId of projects) {
              queryClient.invalidateQueries({
                queryKey: contentKeys.tree("project", workspaceId, projectId, "context"),
              });
              queryClient.invalidateQueries({
                queryKey: contentKeys.mergedTree("project", workspaceId, projectId),
              });
            }
          }
        }
        break;

      case "project":
        for (const workspaceId of affectedWorkspaces) {
          queryClient.invalidateQueries({
            queryKey: projectKeys.byWorkspace(workspaceId),
          });
        }
        break;

      case "workspace":
        // Workspace metadata changed - invalidate all workspace queries
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.all,
        });
        break;

      case "view":
        // View state (.view.json) changed
        queryClient.invalidateQueries({
          queryKey: viewStateKeys.all,
        });
        break;

      case "config":
        // Config changed - this is handled by Zustand persist, not TanStack Query
        break;

      case "unknown":
        // Unknown file type - invalidate everything for safety
        if (affectedWorkspaces.size > 0) {
          for (const workspaceId of affectedWorkspaces) {
            queryClient.invalidateQueries({
              queryKey: taskKeys.byWorkspace(workspaceId),
            });
            queryClient.invalidateQueries({
              queryKey: contentKeys.byWorkspace(workspaceId),
            });
            queryClient.invalidateQueries({
              queryKey: meetingKeys.byWorkspace(workspaceId),
            });
            queryClient.invalidateQueries({
              queryKey: projectKeys.byWorkspace(workspaceId),
            });
          }
        }
        if (hasCaptureChanges) {
          queryClient.invalidateQueries({
            queryKey: captureKeys.all,
          });
        }
        break;
    }
  }
}

export default useQueryInvalidator;
