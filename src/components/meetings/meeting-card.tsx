"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Calendar, Users } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { Meeting } from "@/types";

interface MeetingCardProps {
  meeting: Meeting;
  onClick?: () => void;
}

function formatRelativeDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function MeetingCard({ meeting, onClick }: MeetingCardProps) {
  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-violet-500/10 rounded-md">
            <Calendar className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{meeting.title}</h3>
            <p className="text-xs text-muted-foreground" title={meeting.date}>
              {formatRelativeDate(meeting.date)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {meeting.attendees && meeting.attendees.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {meeting.attendees.length} attendees
          </div>
        )}
        {meeting.preview && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {meeting.preview}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
