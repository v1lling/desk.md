"use client";

import { useMemo } from "react";
import { MeetingCard } from "./meeting-card";
import { EmptyState } from "@/components/ui/empty-state";
import { format, parseISO } from "date-fns";
import type { Meeting } from "@/types";

interface MeetingListProps {
  meetings: Meeting[];
  onMeetingClick?: (meeting: Meeting) => void;
}

interface GroupedMeetings {
  key: string;
  label: string;
  meetings: Meeting[];
}

function groupMeetingsByMonth(meetings: Meeting[]): GroupedMeetings[] {
  // Sort by date descending (newest first)
  const sorted = [...meetings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const groups: Map<string, Meeting[]> = new Map();

  for (const meeting of sorted) {
    const date = parseISO(meeting.date);
    const key = format(date, "yyyy-MM");
    const existing = groups.get(key) || [];
    existing.push(meeting);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([key, meetings]) => ({
    key,
    label: format(parseISO(meetings[0].date), "MMMM yyyy"),
    meetings,
  }));
}

export function MeetingList({ meetings, onMeetingClick }: MeetingListProps) {
  const grouped = useMemo(() => groupMeetingsByMonth(meetings), [meetings]);
  const mostRecentId = grouped[0]?.meetings[0]?.id;

  if (meetings.length === 0) {
    return (
      <EmptyState
        title="No meetings yet"
        description="Create your first meeting note to get started"
      />
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map((group) => (
        <div key={group.key}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 sticky top-0 bg-background py-1">
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onClick={() => onMeetingClick?.(meeting)}
                isLatest={meeting.id === mostRecentId}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
