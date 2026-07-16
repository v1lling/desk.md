import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useCurrentWorkspace, useMeetings, useOpenTab } from "@/stores";
import { useOpenFromQuery } from "@/hooks";
import { useSecondarySidebar } from "@/hooks/use-secondary-sidebar";
import { StatePanel } from "@/components/ui/state-panel";
import { MeetingsTreePane } from "@/components/meetings";

export default function MeetingsPage() {
  const { t } = useTranslation();
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;
  const { data: meetings = [] } = useMeetings(currentWorkspaceId);
  const { openMeeting } = useOpenTab();

  useOpenFromQuery(meetings, openMeeting, "/meetings");

  // Capture ?project= once (e.g. from a project overview quick-link), then clear it.
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialProjectFilter, setInitialProjectFilter] = useState(
    () => searchParams.get("project") || undefined,
  );
  useEffect(() => {
    if (searchParams.has("project")) {
      searchParams.delete("project");
      setSearchParams(searchParams, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The deep-linked filter belongs to the workspace it was opened in: drop it on a real
  // workspace switch, or the keyed pane below re-initializes with a foreign project.
  // null → id is query hydration (cold deep-link load), not a switch — the init survives it.
  const prevWorkspaceRef = useRef(currentWorkspaceId);
  useEffect(() => {
    const prev = prevWorkspaceRef.current;
    prevWorkspaceRef.current = currentWorkspaceId;
    if (prev === null || prev === currentWorkspaceId) return;
    setInitialProjectFilter(undefined);
  }, [currentWorkspaceId]);

  // Register the meetings tree as the secondary sidebar slot for /meetings.
  const pane = useMemo(
    () =>
      currentWorkspaceId ? (
        // Keyed by workspace: the pane's UI state (project filter, search, sort) is chosen
        // within one workspace and must not survive into another — a kept project filter
        // would silently filter by (and default new meetings to) a foreign project.
        <MeetingsTreePane
          key={currentWorkspaceId}
          workspaceId={currentWorkspaceId}
          initialProjectFilter={initialProjectFilter}
        />
      ) : null,
    [currentWorkspaceId, initialProjectFilter],
  );
  useSecondarySidebar("/meetings", pane);

  if (!currentWorkspaceId) {
    return (
      <div className="flex flex-col h-full">
        <StatePanel
          variant="empty"
          display="inline"
          title={t("pages.meetings.selectWorkspaceTitle")}
          description={t("pages.meetings.selectWorkspaceDescription")}
          className="h-full"
        />
      </div>
    );
  }

  // Main pane: empty state. Opening a meeting switches to a meeting tab,
  // and `TabContent` renders the editor here instead.
  return (
    <div className="flex flex-col h-full">
      <StatePanel
        variant="empty"
        display="inline"
        icon={Calendar}
        title={meetings.length === 0 ? t("pages.meetings.noMeetingsTitle") : t("pages.meetings.selectMeetingTitle")}
        description={
          meetings.length === 0
            ? t("pages.meetings.noMeetingsDescription")
            : t("pages.meetings.selectMeetingDescription")
        }
        className="h-full"
      />
    </div>
  );
}
