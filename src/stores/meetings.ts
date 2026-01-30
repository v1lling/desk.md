import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Meeting } from "@/types";
import * as meetingLib from "@/lib/desk/meetings";

// Query keys
export const meetingKeys = {
  all: ["meetings"] as const,
  byWorkspace: (workspaceId: string) => [...meetingKeys.all, "workspace", workspaceId] as const,
  byProject: (workspaceId: string, projectId: string) =>
    [...meetingKeys.byWorkspace(workspaceId), "project", projectId] as const,
  detail: (workspaceId: string, meetingId: string) =>
    [...meetingKeys.byWorkspace(workspaceId), "detail", meetingId] as const,
};

/**
 * Hook to fetch all meetings for a workspace
 */
export function useMeetings(workspaceId: string | null) {
  return useQuery({
    queryKey: meetingKeys.byWorkspace(workspaceId || ""),
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return meetingLib.getMeetings(workspaceId);
    },
    enabled: !!workspaceId,
  });
}

/**
 * Hook to fetch meetings for a specific project
 */
export function useProjectMeetings(workspaceId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: meetingKeys.byProject(workspaceId || "", projectId || ""),
    queryFn: async () => {
      if (!workspaceId || !projectId) throw new Error("workspaceId and projectId are required");
      return meetingLib.getMeetingsByProject(workspaceId, projectId);
    },
    enabled: !!workspaceId && !!projectId,
  });
}

/**
 * Hook to fetch a single meeting
 */
export function useMeeting(workspaceId: string | null, meetingId: string | null) {
  return useQuery({
    queryKey: meetingKeys.detail(workspaceId || "", meetingId || ""),
    queryFn: async () => {
      if (!workspaceId || !meetingId) throw new Error("workspaceId and meetingId are required");
      return meetingLib.getMeeting(workspaceId, meetingId);
    },
    enabled: !!workspaceId && !!meetingId,
  });
}

/**
 * Hook to create a new meeting
 */
export function useCreateMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      workspaceId: string;
      projectId: string;
      title: string;
      date?: string;
      attendees?: string[];
      content?: string;
    }) => meetingLib.createMeeting(data),
    onSuccess: (newMeeting) => {
      queryClient.invalidateQueries({
        queryKey: meetingKeys.byWorkspace(newMeeting.workspaceId),
      });
    },
  });
}

/**
 * Hook to update a meeting
 */
export function useUpdateMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      meetingId,
      workspaceId,
      projectId,
      updates,
    }: {
      meetingId: string;
      workspaceId: string;
      projectId: string;
      updates: Partial<Pick<Meeting, "title" | "date" | "attendees" | "content">>;
    }) => meetingLib.updateMeeting(meetingId, updates, workspaceId, projectId),
    onSuccess: (updatedMeeting, variables) => {
      if (updatedMeeting) {
        queryClient.invalidateQueries({
          queryKey: meetingKeys.byWorkspace(updatedMeeting.workspaceId),
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: meetingKeys.byWorkspace(variables.workspaceId),
        });
      }
    },
  });
}

/**
 * Hook to delete a meeting
 */
export function useDeleteMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ meetingId, workspaceId, projectId }: { meetingId: string; workspaceId: string; projectId: string }) =>
      meetingLib.deleteMeeting(meetingId, workspaceId, projectId).then((success) => ({ success, workspaceId })),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: meetingKeys.byWorkspace(result.workspaceId),
        });
      }
    },
  });
}
