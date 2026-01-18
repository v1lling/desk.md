"use client";

import { MeetingCard } from "./meeting-card";
import type { Meeting } from "@/types";

interface MeetingListProps {
  meetings: Meeting[];
  onMeetingClick?: (meeting: Meeting) => void;
}

export function MeetingList({ meetings, onMeetingClick }: MeetingListProps) {
  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No meetings yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create your first meeting note to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {meetings.map((meeting) => (
        <MeetingCard
          key={meeting.id}
          meeting={meeting}
          onClick={() => onMeetingClick?.(meeting)}
        />
      ))}
    </div>
  );
}
