import { useState, useMemo, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MeetingList, NewMeetingModal } from "@/components/meetings";
import { FilterBar } from "@/components/ui/filter-bar";
import { Button } from "@/components/ui/button";
import { useMeetings, useCurrentWorkspace, useOpenTab } from "@/stores";
import { useProjectName, useOpenFromQuery, useGroupedItems } from "@/hooks";
import { FolderKanban, Plus, Calendar } from "lucide-react";
import type { Meeting } from "@/types";
import { Link } from "react-router-dom";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionGroup } from "@/components/ui/section-group";

export default function MeetingsPage() {
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;
  const { data: meetings = [], isLoading } = useMeetings(currentWorkspaceId);
  const { projects, getProjectName } = useProjectName(currentWorkspaceId);
  const { openMeeting } = useOpenTab();

  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [filterProject, setFilterProject] = useState<string>("all");

  useOpenFromQuery(meetings, openMeeting, "/meetings");

  const handleMeetingClick = (meeting: Meeting) => {
    openMeeting(meeting);
  };

  const filteredMeetings = useMemo(() => {
    if (filterProject === "all") return meetings;
    return meetings.filter((meeting) => meeting.projectId === filterProject);
  }, [meetings, filterProject]);

  const getProjectId = useCallback((meeting: Meeting) => meeting.projectId, []);
  const groupedMeetings = useGroupedItems(filteredMeetings, getProjectId);

  const getDisplayProjectName = useCallback(
    (projectId: string) => {
      if (projectId === "_unassigned") return "No project";
      return getProjectName(projectId) || projectId;
    },
    [getProjectName]
  );

  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: p.name })),
    [projects]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FilterBar
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
            <LoadingState label="meetings" display="inline" />
          ) : filteredMeetings.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No meetings found"
              description={
                filterProject !== "all"
                  ? "Try selecting a different project or create a new meeting"
                  : "Create your first meeting note to get started"
              }
              display="inline"
            />
          ) : filterProject === "all" ? (
            <div className="space-y-4">
              {Object.entries(groupedMeetings).map(([projectId, projectMeetings]) => (
                <SectionGroup
                  key={projectId}
                  icon={<FolderKanban className="h-4 w-4" />}
                  title={
                    <Link to={`/projects/${projectId}/tasks`} className="hover:underline">
                      {getDisplayProjectName(projectId)}
                    </Link>
                  }
                  count={projectMeetings.length}
                >
                  <MeetingList meetings={projectMeetings} onMeetingClick={handleMeetingClick} />
                </SectionGroup>
              ))}
            </div>
          ) : (
            <MeetingList meetings={filteredMeetings} onMeetingClick={handleMeetingClick} />
          )}
        </main>
      </ScrollArea>

      <NewMeetingModal open={showNewMeeting} onClose={() => setShowNewMeeting(false)} />
    </div>
  );
}
