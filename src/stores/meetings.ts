import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Meeting } from "@/types";
import * as meetingLib from "@/lib/orbit/meetings";

// Query keys
export const meetingKeys = {
  all: ["meetings"] as const,
  byArea: (areaId: string) => [...meetingKeys.all, "area", areaId] as const,
  byProject: (areaId: string, projectId: string) =>
    [...meetingKeys.byArea(areaId), "project", projectId] as const,
  detail: (areaId: string, meetingId: string) =>
    [...meetingKeys.byArea(areaId), "detail", meetingId] as const,
};

/**
 * Hook to fetch all meetings for an area
 */
export function useMeetings(areaId: string | null) {
  return useQuery({
    queryKey: meetingKeys.byArea(areaId || ""),
    queryFn: () => meetingLib.getMeetings(areaId!),
    enabled: !!areaId,
  });
}

/**
 * Hook to fetch meetings for a specific project
 */
export function useProjectMeetings(areaId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: meetingKeys.byProject(areaId || "", projectId || ""),
    queryFn: () => meetingLib.getMeetingsByProject(areaId!, projectId!),
    enabled: !!areaId && !!projectId,
  });
}

/**
 * Hook to fetch a single meeting
 */
export function useMeeting(areaId: string | null, meetingId: string | null) {
  return useQuery({
    queryKey: meetingKeys.detail(areaId || "", meetingId || ""),
    queryFn: () => meetingLib.getMeeting(areaId!, meetingId!),
    enabled: !!areaId && !!meetingId,
  });
}

/**
 * Hook to create a new meeting
 */
export function useCreateMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      areaId: string;
      projectId: string;
      title: string;
      date?: string;
      attendees?: string[];
      duration?: number;
      location?: string;
      content?: string;
    }) => meetingLib.createMeeting(data),
    onSuccess: (newMeeting) => {
      queryClient.invalidateQueries({
        queryKey: meetingKeys.byArea(newMeeting.areaId),
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
      areaId,
      projectId,
      updates,
    }: {
      meetingId: string;
      areaId: string;
      projectId: string;
      updates: Partial<Pick<Meeting, "title" | "date" | "attendees" | "duration" | "location" | "content">>;
    }) => meetingLib.updateMeeting(meetingId, updates, areaId, projectId),
    onSuccess: (updatedMeeting, variables) => {
      if (updatedMeeting) {
        queryClient.invalidateQueries({
          queryKey: meetingKeys.byArea(updatedMeeting.areaId),
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: meetingKeys.byArea(variables.areaId),
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
    mutationFn: ({ meetingId, areaId, projectId }: { meetingId: string; areaId: string; projectId: string }) =>
      meetingLib.deleteMeeting(meetingId, areaId, projectId).then((success) => ({ success, areaId })),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: meetingKeys.byArea(result.areaId),
        });
      }
    },
  });
}
