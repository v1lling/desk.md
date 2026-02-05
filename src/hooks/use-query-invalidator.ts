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
  getItemTypeFromPath,
  getWorkspaceIdFromPath,
  getProjectIdFromPath,
  isCapturePath,
  type WatchEvent,
} from "@/lib/desk/watcher";
import {
  taskKeys,
  contentKeys,
  meetingKeys,
  projectKeys,
  workspaceKeys,
  viewStateKeys,
  captureKeys,
} from "@/stores";
import {
  getFileTreeService,
  getContentCache,
  connectToWatcher,
  disconnectFromWatcher,
  fileTreeKeys,
} from "@/lib/desk/file-cache";
import {
  useOpenEditorRegistry,
  type EditorSession,
} from "@/stores/open-editor-registry";
import { publishContentUpdate, publishDeleted } from "@/stores/editor-event-bus";
import { exists, readTextFile } from "@/lib/desk/tauri-fs";
import { parseMarkdown } from "@/lib/desk/parser";

/**
 * Hook to initialize file watching and route events
 * Call this once in your app root (e.g., layout.tsx or providers)
 */
export function useQueryInvalidator() {
  const queryClient = useQueryClient();
  const isInitialized = useRef(false);

  useEffect(() => {
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
  const affectedWorkspaces = new Set<string>();
  const affectedProjects = new Map<string, Set<string>>(); // workspaceId -> Set<projectId>
  const affectedTypes = new Set<string>();
  let hasCaptureChanges = false;

  // Track which paths were handled by editors (to skip query invalidation)
  const handledByEditor = new Set<string>();

  // CRITICAL: Invalidate FileTreeService cache FIRST, before any TanStack Query refetch
  // This prevents race condition where query refetches stale cached content
  // (cache-invalidator.ts also invalidates, but runs as separate subscriber - timing not guaranteed)
  const contentCache = getContentCache();
  const fileTreeService = getFileTreeService();
  for (const path of event.paths) {
    contentCache.invalidate(path);
    // Also invalidate prefix for directory-level changes
    contentCache.invalidatePrefix(path + "/");
  }
  // Clear the tree cache as well to force fresh directory listings
  fileTreeService.clearCache();

  // First pass: check each path for open editors
  for (const path of event.paths) {
    const session = registry.getSession(path);

    if (session) {
      // ═══════════════════════════════════════════════════════════════════
      // File is OPEN in editor - check for external changes
      // ═══════════════════════════════════════════════════════════════════
      const handled = await handleOpenFileChange(path, session, event.kind);
      if (handled) {
        handledByEditor.add(path);
      }
    }
  }

  // Second pass: analyze paths for query invalidation (skipping editor-handled paths)
  for (const path of event.paths) {
    // Skip if this path was handled by an editor
    if (handledByEditor.has(path)) {
      continue;
    }

    const itemType = getItemTypeFromPath(path);
    const workspaceId = getWorkspaceIdFromPath(path);
    const projectId = getProjectIdFromPath(path);

    affectedTypes.add(itemType);

    // Add workspace to affected set (including _personal workspace)
    if (workspaceId) {
      affectedWorkspaces.add(workspaceId);
      if (projectId) {
        if (!affectedProjects.has(workspaceId)) {
          affectedProjects.set(workspaceId, new Set());
        }
        affectedProjects.get(workspaceId)!.add(projectId);
      }
    }

    // Check for capture tasks (separate invalidation)
    if (isCapturePath(path)) {
      hasCaptureChanges = true;
    }
  }

  // Log what's happening
  if (handledByEditor.size > 0) {
    console.log(
      `[query-invalidator] ${handledByEditor.size} path(s) routed to editor(s)`
    );
  }

  if (affectedTypes.size > 0) {
    console.log(
      `[query-invalidator] File change: ${event.kind}`,
      `types: [${Array.from(affectedTypes).join(", ")}]`,
      `workspaces: [${Array.from(affectedWorkspaces).join(", ")}]`,
      hasCaptureChanges ? "(includes capture)" : ""
    );
  }

  // Invalidate caches based on what changed (for non-editor paths)
  invalidateQueriesForChanges(
    affectedTypes,
    affectedWorkspaces,
    affectedProjects,
    hasCaptureChanges,
    queryClient
  );

  // Also invalidate file-tree queries for any file change
  // The file-tree service handles its own internal cache invalidation via watcher-integration
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
    const fileExists = await exists(path);
    if (!fileExists) {
      useOpenEditorRegistry.getState().handlePathDeleted(path);
      publishDeleted(path);
      return true;
    }
  }

  try {
    const fileContent = await readTextFile(path);

    // Parse to extract body for comparison (registry stores body only, not full file with frontmatter)
    const { content: fileBody } = parseMarkdown<Record<string, unknown>>(fileContent);

    // Body matches what we last saved → our save event, ignore
    if (fileBody === session.lastSavedContent) {
      return true; // Handled (it was our own save)
    }

    // External change → update editor via event bus
    console.log(
      `[query-invalidator] External change detected: ${path.split("/").pop()}`
    );
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
        console.log("[query-invalidator] Config file changed externally");
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
