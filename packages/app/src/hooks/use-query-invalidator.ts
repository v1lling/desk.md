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
} from "@desk/core";
import {
  taskKeys,
  contentKeys,
  meetingKeys,
  projectKeys,
  workspaceKeys,
  viewStateKeys,
  captureKeys,
  dashboardKeys,
} from "@/stores";
import {
  getHostContentCache,
  getHostFileTreeService,
} from "@/lib/host-files";
import { connectToWatcher, disconnectFromWatcher } from "@/lib/cache-invalidator";
import { fileTreeKeys } from "@/lib/file-tree-hooks";
import {
  useOpenEditorRegistry,
  type EditorSession,
} from "@/stores/open-editor-registry";
import { publishContentUpdate, publishDeleted } from "@desk/core";
import { hostFileExists, readHostTextFile } from "@/lib/host-files";
import { parseMarkdown } from "@desk/core";
import { isLocalDisk } from "@/lib/connection";
import { getDeskService } from "@desk/core";
import { notifyLocalMaintenanceOfExternalChanges } from "@/lib/host-maintenance";
import {
  writePerWorkspaceAgentFiles,
  writeTopLevelAgentFiles,
} from "@/lib/smart-index/agent-files";
import {
  planQueryInvalidations,
  type QueryInvalidationTarget,
} from "@/lib/query-invalidation-plan";

const pendingAgentFileWorkspaces = new Set<string>();
let pendingTopLevelAgentFiles = false;
let agentFileTimer: ReturnType<typeof setTimeout> | null = null;

/** Coalesce watcher bursts before rebuilding generated files that inline entity overviews. */
function scheduleAgentFileRefresh(paths: string[]): void {
  for (const path of paths) {
    const type = getItemTypeFromPath(path);
    if (type !== "workspace" && type !== "project") continue;
    const workspaceId = getWorkspaceIdFromPath(path);
    if (workspaceId) pendingAgentFileWorkspaces.add(workspaceId);
    if (type === "workspace") pendingTopLevelAgentFiles = true;
  }
  if (pendingAgentFileWorkspaces.size === 0 && !pendingTopLevelAgentFiles) return;
  if (agentFileTimer) clearTimeout(agentFileTimer);

  agentFileTimer = setTimeout(() => {
    agentFileTimer = null;
    const workspaceIds = [...pendingAgentFileWorkspaces];
    const refreshTopLevel = pendingTopLevelAgentFiles;
    pendingAgentFileWorkspaces.clear();
    pendingTopLevelAgentFiles = false;

    const service = getDeskService();
    const writes = workspaceIds.map(async (workspaceId) => {
      const [workspace, projects] = await Promise.all([
        service.getWorkspace(workspaceId),
        service.getProjects(workspaceId),
      ]);
      if (workspace) await writePerWorkspaceAgentFiles(workspaceId, workspace, projects);
    });
    if (refreshTopLevel) {
      writes.push(
        service.getWorkspaces().then((workspaces) => writeTopLevelAgentFiles(workspaces)),
      );
    }
    Promise.all(writes).catch((error) => {
      console.warn("[query-invalidator] Failed to refresh generated agent files:", error);
    });
  }, 250);
}

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
    // guard provider blocks host-file access), so the whole watcher is skipped — list
    // refresh after writes is driven by query invalidation instead.
    if (!isLocalDisk()) return;

    // Prevent double initialization in strict mode
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Initialize file tree service first
    const fileTreeService = getHostFileTreeService();
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
  scheduleAgentFileRefresh(event.paths);

  // Feed the change into the maintenance engine (core desk/maintenance). The engine gets the
  // app's own writes from the domain-write bus already; this covers EXTERNAL edits — an agent
  // or script writing into the folder gets the same index update. The double
  // arrival of our own writes is absorbed by the engine's debounces.
  notifyLocalMaintenanceOfExternalChanges(
    event.paths,
    event.kind === "remove" ? "remove" : "modify",
  );
}

/**
 * Clear the file caches for the given paths and invalidate every TanStack query
 * affected by them. Driven by the file-watcher path (handleFileChange).
 *
 * The cache clear always runs BEFORE the query invalidation so refetches can't
 * serve stale cached content.
 */
function invalidateQueriesForPaths(
  paths: string[],
  queryClient: ReturnType<typeof useQueryClient>
): void {
  const contentCache = getHostContentCache();
  const fileTreeService = getHostFileTreeService();
  for (const path of paths) {
    contentCache.invalidate(path);
    contentCache.invalidatePrefix(path + "/");
  }
  fileTreeService.clearCache();

  for (const target of planQueryInvalidations(paths)) {
    invalidateQueryTarget(target, queryClient);
  }
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
    const fileExists = await hostFileExists(path);
    if (!fileExists) {
      useOpenEditorRegistry.getState().handlePathDeleted(path);
      publishDeleted(path);
      return true;
    }
  }

  try {
    const fileContent = await readHostTextFile(path);

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
 * Apply one semantic invalidation decision to TanStack Query.
 */
function invalidateQueryTarget(
  target: QueryInvalidationTarget,
  queryClient: ReturnType<typeof useQueryClient>
): void {
  switch (target.type) {
    case "tasks":
      queryClient.invalidateQueries({
        queryKey: taskKeys.byWorkspace(target.workspaceId),
      });
      break;
    case "capture":
      queryClient.invalidateQueries({ queryKey: captureKeys.all });
      break;
    case "view-state":
      queryClient.invalidateQueries({ queryKey: viewStateKeys.all });
      break;
    case "content":
      queryClient.invalidateQueries({
        queryKey: contentKeys.byWorkspace(target.workspaceId),
      });
      break;
    case "content-tree":
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          target.scope,
          target.workspaceId,
          target.projectId,
        ),
      });
      break;
    case "meetings":
      queryClient.invalidateQueries({
        queryKey: meetingKeys.byWorkspace(target.workspaceId),
      });
      break;
    case "projects":
      queryClient.invalidateQueries({
        queryKey: projectKeys.byWorkspace(target.workspaceId),
      });
      break;
    case "workspaces":
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      break;
    case "dashboard":
      queryClient.invalidateQueries({ queryKey: dashboardKeys.overviewRoot() });
      break;
    case "file-tree":
      queryClient.invalidateQueries({ queryKey: fileTreeKeys.all });
      break;
  }
}

export default useQueryInvalidator;
