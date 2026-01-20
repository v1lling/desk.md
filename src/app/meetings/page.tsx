"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { MeetingList, MeetingEditor, NewMeetingModal } from "@/components/meetings";
import { EntityFilterBar } from "@/components/ui/entity-filter-bar";
import { useMeetings, useProjects, useCurrentWorkspace } from "@/stores";
import { FolderKanban } from "lucide-react";
import type { Meeting } from "@/types";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function MeetingsPage() {
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;
  const { data: meetings = [], isLoading } = useMeetings(currentWorkspaceId);
  const { data: projects = [] } = useProjects(currentWorkspaceId);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [filterProject, setFilterProject] = useState<string>("all");

  // Handle ?open= query param from search navigation
  useEffect(() => {
    const openMeetingId = searchParams.get("open");
    if (openMeetingId && meetings.length > 0) {
      const meetingToOpen = meetings.find((m) => m.id === openMeetingId);
      if (meetingToOpen) {
        setSelectedMeeting(meetingToOpen);
        // Clear the URL param after opening
        router.replace("/meetings", { scroll: false });
      }
    }
  }, [searchParams, meetings, router]);

  const handleMeetingClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
  };

  // Filter meetings by project
  const filteredMeetings = useMemo(() => {
    if (filterProject === "all") return meetings;
    return meetings.filter((meeting) => meeting.projectId === filterProject);
  }, [meetings, filterProject]);

  // Group meetings by project for display
  const groupedMeetings = useMemo(() => {
    const groups: Record<string, Meeting[]> = {};
    filteredMeetings.forEach((meeting) => {
      const key = meeting.projectId;
      if (!groups[key]) groups[key] = [];
      groups[key].push(meeting);
    });
    return groups;
  }, [filteredMeetings]);

  const getProjectName = (projectId: string) => {
    if (projectId === "_unassigned") return "No project";
    const project = projects.find((p) => p.id === projectId);
    return project?.name || projectId;
  };

  // Prepare filter options
  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: p.name })),
    [projects]
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Meetings"
        action={{
          label: "New Meeting",
          onClick: () => setShowNewMeeting(true),
        }}
      />

      {/* Filter Bar */}
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
      />

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-muted-foreground">
              Loading meetings...
            </div>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No meetings found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filterProject !== "all"
                ? "Try selecting a different project or create a new meeting"
                : "Create your first meeting note to get started"}
            </p>
          </div>
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
                    {getProjectName(projectId)}
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

      <MeetingEditor
        meeting={selectedMeeting}
        open={!!selectedMeeting}
        onClose={() => setSelectedMeeting(null)}
      />

      <NewMeetingModal open={showNewMeeting} onClose={() => setShowNewMeeting(false)} />
    </div>
  );
}
