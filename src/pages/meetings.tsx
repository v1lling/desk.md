import { useMemo } from "react";
import { useCurrentWorkspace, useMeetings, useOpenTab } from "@/stores";
import { useOpenFromQuery } from "@/hooks";
import { useSecondarySidebar } from "@/hooks/use-secondary-sidebar";
import { StatePanel } from "@/components/ui/state-panel";
import { MeetingsTreePane } from "@/components/meetings";

export default function MeetingsPage() {
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;
  const { data: meetings = [] } = useMeetings(currentWorkspaceId);
  const { openMeeting } = useOpenTab();

  useOpenFromQuery(meetings, openMeeting, "/meetings");

  // Register the meetings tree as the secondary sidebar slot for /meetings.
  const pane = useMemo(
    () => (currentWorkspaceId ? <MeetingsTreePane workspaceId={currentWorkspaceId} /> : null),
    [currentWorkspaceId],
  );
  useSecondarySidebar("/meetings", pane);

  if (!currentWorkspaceId) {
    return (
      <div className="flex flex-col h-full p-4">
        <StatePanel
          variant="empty"
          title="Select a workspace"
          description="Choose a workspace in the sidebar to view meetings."
          className="h-full"
        />
      </div>
    );
  }

  // Main pane: empty state. Opening a meeting switches to a meeting tab,
  // and `TabContent` renders the editor here instead.
  return (
    <div className="flex flex-col h-full p-4">
      <StatePanel
        variant="empty"
        title="Select a meeting"
        description="Choose a meeting from the tree to start editing."
        className="h-full"
      />
    </div>
  );
}
