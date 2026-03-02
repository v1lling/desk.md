"use client";

import { Calendar, Users, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { Meeting } from "@/types";

interface MeetingCardProps {
  meeting: Meeting;
  onClick?: () => void;
  isLatest?: boolean;
}

function formatMeetingDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, "EEE, MMM d");
  } catch {
    return dateStr;
  }
}

export function MeetingCard({ meeting, onClick, isLatest }: MeetingCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-3 group",
        "hover:bg-accent/50"
      )}
    >
      <div
        className={cn(
          "p-1.5 rounded-md shrink-0",
          isLatest ? "bg-violet-500/20" : "bg-muted"
        )}
      >
        <Calendar
          className={cn(
            "h-3.5 w-3.5",
            isLatest
              ? "text-violet-600 dark:text-violet-400"
              : "text-muted-foreground"
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">
            {meeting.title}
          </span>
          {isLatest && (
            <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded shrink-0">
              Latest
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatMeetingDate(meeting.date)}</span>
          {meeting.attendees && meeting.attendees.length > 0 && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                <Users className="h-3 w-3" />
                {meeting.attendees.length}
              </span>
            </>
          )}
          {meeting.preview && (
            <>
              <span>·</span>
              <span className="truncate">{meeting.preview}</span>
            </>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground shrink-0" />
    </button>
  );
}
