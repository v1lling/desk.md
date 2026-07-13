
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MeetingCard } from "./meeting-card";
import { EmptyState } from "@/components/ui/empty-state";
import { format, parseISO } from "date-fns";
import { compareDatesDesc } from "@desk/core";
import type { Meeting } from "@desk/core/types";

interface MeetingListProps {
  meetings: Meeting[];
  onMeetingClick?: (meeting: Meeting) => void;
}

interface GroupedMeetings {
  key: string;
  label: string;
  meetings: Meeting[];
}

const NO_DATE_KEY = "no-date";

function groupMeetingsByMonth(meetings: Meeting[], noDateLabel: string): GroupedMeetings[] {
  // Sort by date descending (newest first). Dates are `YYYY-MM-DD`, so a string
  // compare is chronological and avoids UTC-parsing a date-only value.
  // Meetings without a date go into one trailing group.
  const dated = meetings.filter((m) => m.date);
  const undated = meetings.filter((m) => !m.date);
  const sorted = [...dated].sort((a, b) => compareDatesDesc(a.date, b.date));

  const groups: Map<string, Meeting[]> = new Map();

  for (const meeting of sorted) {
    const date = parseISO(meeting.date!);
    const key = format(date, "yyyy-MM");
    const existing = groups.get(key) || [];
    existing.push(meeting);
    groups.set(key, existing);
  }

  const result = Array.from(groups.entries()).map(([key, meetings]) => ({
    key,
    label: format(parseISO(meetings[0].date!), "MMMM yyyy"),
    meetings,
  }));
  if (undated.length > 0) {
    result.push({ key: NO_DATE_KEY, label: noDateLabel, meetings: undated });
  }
  return result;
}

export function MeetingList({ meetings, onMeetingClick }: MeetingListProps) {
  const { t } = useTranslation();
  const grouped = useMemo(
    () => groupMeetingsByMonth(meetings, t("pages.meetings.groups.noDate")),
    [meetings, t],
  );
  // No "Latest" pill when only undated meetings exist — there is no recency to claim.
  const mostRecentId = grouped[0]?.key !== NO_DATE_KEY ? grouped[0]?.meetings[0]?.id : undefined;

  if (meetings.length === 0) {
    return (
      <EmptyState
        title={t("emptyStates.meetings.none.title")}
        description={t("emptyStates.meetings.none.description")}
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
