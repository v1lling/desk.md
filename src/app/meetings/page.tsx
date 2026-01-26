"use client";

import { useState, useMemo, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MeetingList, NewMeetingModal } from "@/components/meetings";
import { EntityFilterBar } from "@/components/ui/entity-filter-bar";
import { Button } from "@/components/ui/button";
import { useMeetings, useCurrentWorkspace, useOpenTab } from "@/stores";
import { useProjectName, useOpenFromQuery, useGroupedItems } from "@/hooks";
import { FolderKanban, Plus } from "lucide-react";
import type { Meeting } from "@/types";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Calendar } from "lucide-react";

export default function MeetingsPage() {
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;
  const { data: meetings = [], isLoading } = useMeetings(currentWorkspaceId);
  const { projects, getProjectName } = useProjectName(currentWorkspaceId);
  const { openMeeting } = useOpenTab();

  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [filterProject, setFilterProject] = useState<string>("all");

  // Handle ?open= query param from search navigation
  useOpenFromQuery(meetings, openMeeting, "/meetings");

  const handleMeetingClick = (meeting: Meeting) => {
    openMeeting(meeting);
  };

  // Filter meetings by project
  const filteredMeetings = useMemo(() => {
    if (filterProject === "all") return meetings;
    return meetings.filter((meeting) => meeting.projectId === filterProject);
  }, [meetings, filterProject]);

  // Group meetings by project for display
  const getProjectId = useCallback((meeting: Meeting) => meeting.projectId, []);
  const groupedMeetings = useGroupedItems(filteredMeetings, getProjectId);

  // Project name with fallback for unassigned
  const getDisplayProjectName = useCallback(
    (projectId: string) => {
      if (projectId === "_unassigned") return "No project";
      return getProjectName(projectId) || projectId;
    },
    [getProjectName]
  );

  // Prepare filter options
  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: p.name })),
    [projects]
  );

  return (
    <div className="flex flex-col h-full">
      <EntityFilterBar
        filters={[
          {
            id: "project",
            label: "Project",
            value: filterProject,
            onChange: setFilterProject,
            options: projectOptions,
            allLabel: "All projects",
            width: "w-[200px]",
          },
        ]}
        count={filteredMeetings.length}
        countLabel="meetings"
        rightElement={
          <Button size="sm" onClick={() => setShowNewMeeting(true)}>
            <Plus className="size-4 mr-1" />
            New Meeting
          </Button>
        }
      />

      <ScrollArea className="flex-1">
        <main className="p-4">
          {isLoading ? (
            <LoadingState label="meetings" />
          ) : filteredMeetings.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No meetings found"
              description={
                filterProject !== "all"
                  ? "Try selecting a different project or create a new meeting"
                  : "Create your first meeting note to get started"
              }
            />
          ) : filterProject === "all" ? (
            // Grouped view when showing all
            <div className="space-y-8">
              {Object.entries(groupedMeetings).map(([projectId, projectMeetings]) => (
                <div key={projectId}>
                  <div className="flex items-center gap-2 mb-4">
                    <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    <Link
                      href={`/projects/view?id=${projectId}`}
                      className="font-medium hover:underline"
                    >
                      {getDisplayProjectName(projectId)}
                    </Link>
                    <Badge variant="outline" className="ml-2">
                      {projectMeetings.length}
                    </Badge>
                  </div>
                  <MeetingList meetings={projectMeetings} onMeetingClick={handleMeetingClick} />
                </div>
              ))}
            </div>
          ) : (
            // Simple list when filtered
            <MeetingList meetings={filteredMeetings} onMeetingClick={handleMeetingClick} />
          )}
        </main>
      </ScrollArea>

      <NewMeetingModal open={showNewMeeting} onClose={() => setShowNewMeeting(false)} />
    </div>
  );
}
