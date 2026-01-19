/**
 * useFileWatcher Hook
 *
 * Connects the file system watcher to TanStack Query cache invalidation.
 * Should be used once at the app root level.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  startWatching,
  stopWatching,
  onFileChange,
  getItemTypeFromPath,
  getWorkspaceIdFromPath,
  type WatchEvent,
} from "@/lib/orbit/watcher";
import {
  taskKeys,
  noteKeys,
  meetingKeys,
  projectKeys,
  workspaceKeys,
  viewStateKeys,
} from "@/stores";

/**
 * Hook to initialize file watching and connect to query cache
 * Call this once in your app root (e.g., layout.tsx or providers)
 */
export function useFileWatcher() {
  const queryClient = useQueryClient();
  const isInitialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization in strict mode
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Start the watcher
    startWatching();

    // Subscribe to file changes
    const unsubscribe = onFileChange((event: WatchEvent) => {
      handleFileChange(event, queryClient);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
      stopWatching();
      isInitialized.current = false;
    };
  }, [queryClient]);
}

/**
 * Handle file change events and invalidate appropriate caches
 */
function handleFileChange(
  event: WatchEvent,
  queryClient: ReturnType<typeof useQueryClient>
) {
  const affectedWorkspaces = new Set<string>();
  const affectedTypes = new Set<string>();

  // Analyze all changed paths
  for (const path of event.paths) {
    const itemType = getItemTypeFromPath(path);
    const workspaceId = getWorkspaceIdFromPath(path);

    affectedTypes.add(itemType);
    if (workspaceId) {
      affectedWorkspaces.add(workspaceId);
    }
  }

  console.log(
    `[watcher] File change: ${event.kind}`,
    `types: [${Array.from(affectedTypes).join(", ")}]`,
    `areas: [${Array.from(affectedWorkspaces).join(", ")}]`
  );

  // Invalidate caches based on what changed
  for (const itemType of affectedTypes) {
    switch (itemType) {
      case "task":
        // Invalidate tasks for affected areas
        for (const workspaceId of affectedWorkspaces) {
          queryClient.invalidateQueries({
            queryKey: taskKeys.byWorkspace(workspaceId),
          });
        }
        // Also invalidate view state (task ordering)
        queryClient.invalidateQueries({
          queryKey: viewStateKeys.all,
        });
        break;

      case "note":
        for (const workspaceId of affectedWorkspaces) {
          queryClient.invalidateQueries({
            queryKey: noteKeys.byWorkspace(workspaceId),
          });
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
        // Could trigger a settings reload if needed
        console.log("[watcher] Config file changed externally");
        break;

      case "unknown":
        // Unknown file type - invalidate everything for safety
        if (affectedWorkspaces.size > 0) {
          for (const workspaceId of affectedWorkspaces) {
            queryClient.invalidateQueries({
              queryKey: taskKeys.byWorkspace(workspaceId),
            });
            queryClient.invalidateQueries({
              queryKey: noteKeys.byWorkspace(workspaceId),
            });
            queryClient.invalidateQueries({
              queryKey: meetingKeys.byWorkspace(workspaceId),
            });
            queryClient.invalidateQueries({
              queryKey: projectKeys.byWorkspace(workspaceId),
            });
          }
        }
        break;
    }
  }
}

export default useFileWatcher;
