/**
 * useSearchIndex Hook
 *
 * Builds and maintains the search index.
 * - Builds index on app startup
 * - Updates index when file watcher detects changes
 */

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  rebuildIndex,
  upsertItem,
  removeItem,
  taskToSearchItem,
  docToSearchItem,
  meetingToSearchItem,
  projectToSearchItem,
  type SearchItem,
} from "@/lib/orbit/search-index";
import {
  onFileChange,
  getItemTypeFromPath,
  getWorkspaceIdFromPath,
  getProjectIdFromPath,
  type WatchEvent,
} from "@/lib/orbit/watcher";
import { isTauri } from "@/lib/orbit/tauri-fs";
import * as taskLib from "@/lib/orbit/tasks";
import * as docLib from "@/lib/orbit/docs";
import * as meetingLib from "@/lib/orbit/meetings";
import * as projectLib from "@/lib/orbit/projects";
import * as workspaceLib from "@/lib/orbit/workspaces";

/**
 * Hook to initialize and maintain the search index
 * Call this once at app root level
 */
export function useSearchIndex() {
  const queryClient = useQueryClient();
  const isBuilding = useRef(false);
  const isInitialized = useRef(false);

  // Build the full index
  const buildFullIndex = useCallback(async () => {
    if (isBuilding.current) return;
    isBuilding.current = true;

    console.log("[search-index] Building full index...");
    const startTime = performance.now();

    try {
      const searchItems: SearchItem[] = [];

      // Get all workspaces
      const workspaces = await workspaceLib.getWorkspaces();
      const workspaceMap = new Map(workspaces.map((a) => [a.id, a.name]));

      // For each workspace, get all projects, tasks, notes, meetings
      for (const workspace of workspaces) {
        // Get projects
        const projects = await projectLib.getProjects(workspace.id);
        const projectMap = new Map(projects.map((p) => [p.id, p.name]));

        // Add projects to index
        for (const project of projects) {
          searchItems.push(projectToSearchItem(project, workspace.name));
        }

        // Get tasks for the workspace
        const tasks = await taskLib.getTasks(workspace.id);
        for (const task of tasks) {
          searchItems.push(
            taskToSearchItem(task, workspace.name, projectMap.get(task.projectId))
          );
        }

        // Get docs for the workspace
        const docs = await docLib.getDocs(workspace.id);
        for (const doc of docs) {
          searchItems.push(
            docToSearchItem(doc, workspace.name, projectMap.get(doc.projectId))
          );
        }

        // Get meetings for the workspace
        const meetings = await meetingLib.getMeetings(workspace.id);
        for (const meeting of meetings) {
          searchItems.push(
            meetingToSearchItem(
              meeting,
              workspace.name,
              projectMap.get(meeting.projectId)
            )
          );
        }
      }

      // Build the index
      rebuildIndex(searchItems);

      const elapsed = performance.now() - startTime;
      console.log(
        `[search-index] Index built in ${elapsed.toFixed(0)}ms (${searchItems.length} items)`
      );
    } catch (err) {
      console.error("[search-index] Failed to build index:", err);
    } finally {
      isBuilding.current = false;
    }
  }, []);

  // Handle file change events - update index incrementally
  const handleFileChange = useCallback(
    async (event: WatchEvent) => {
      // For now, rebuild the affected workspace's items
      // Future optimization: do true incremental updates
      const affectedAreas = new Set<string>();

      for (const path of event.paths) {
        const workspaceId = getWorkspaceIdFromPath(path);
        if (workspaceId) {
          affectedAreas.add(workspaceId);
        }
      }

      if (affectedAreas.size > 0) {
        // Simple approach: rebuild full index on any change
        // This is fast enough for typical datasets
        await buildFullIndex();
      }
    },
    [buildFullIndex]
  );

  // Initialize on mount
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Build initial index
    buildFullIndex();

    // Subscribe to file changes (Tauri mode only)
    if (isTauri()) {
      const unsubscribe = onFileChange(handleFileChange);
      return () => {
        unsubscribe();
        isInitialized.current = false;
      };
    }
  }, [buildFullIndex, handleFileChange]);

  return {
    rebuildIndex: buildFullIndex,
  };
}

export default useSearchIndex;
