/**
 * Capture Store - Quick capture/triage inbox
 *
 * Capture tasks are a quick-triage area inside the home workspace.
 * They're meant for quick capture and later triage to proper projects.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task, TaskPriority } from "@/types";
import * as captureLib from "@/lib/desk/personal";
import { taskKeys } from "./tasks";

// Query keys for capture tasks (triage inbox)
export const captureKeys = {
  all: ["capture"] as const,
  tasks: () => [...captureKeys.all, "tasks"] as const,
};

// ============================================================================
// CAPTURE TASKS (Quick Capture / Triage Inbox)
// ============================================================================

/**
 * Hook to fetch capture tasks (quick capture for later triage)
 */
export function useCaptureTasks() {
  return useQuery({
    queryKey: captureKeys.tasks(),
    queryFn: () => captureLib.getCaptureTasks(),
  });
}

/**
 * Hook to create a capture task (quick capture)
 */
export function useCreateCaptureTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      priority?: TaskPriority;
      due?: string;
      content?: string;
    }) => captureLib.createCaptureTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: captureKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/**
 * Hook to update a capture task
 */
export function useUpdateCaptureTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      updates,
    }: {
      taskId: string;
      updates: Partial<Pick<Task, "title" | "status" | "priority" | "due" | "content">>;
    }) => captureLib.updateCaptureTask(taskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: captureKeys.all });
    },
  });
}

/**
 * Hook to delete a capture task
 */
export function useDeleteCaptureTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => captureLib.deleteCaptureTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: captureKeys.all });
    },
  });
}

/**
 * Hook to move task from capture to the home workspace (unassigned)
 */
export function useMoveCaptureToPersonal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => captureLib.moveCaptureToPersonal(taskId),
    onSuccess: (movedTask) => {
      queryClient.invalidateQueries({ queryKey: captureKeys.tasks() });
      if (movedTask) {
        queryClient.invalidateQueries({ queryKey: taskKeys.byWorkspace(movedTask.workspaceId) });
      }
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/**
 * Hook to move task from capture to a workspace project
 */
export function useMoveCaptureToWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      workspaceId,
      projectId,
    }: {
      taskId: string;
      workspaceId: string;
      projectId: string;
    }) => captureLib.moveCaptureToWorkspace(taskId, workspaceId, projectId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: captureKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: taskKeys.byWorkspace(variables.workspaceId) });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

