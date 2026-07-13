import { useCallback, useMemo, useState } from "react";
import { ArrowDown01, ArrowUp01, Calendar, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatePanel } from "@/components/ui/state-panel";
import { ListPane, ListRow, SectionLabel, type ListPaneSortOption } from "@/components/patterns";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/tree-count";
import { safeFormat } from "@/lib/i18n/format";
import type { Meeting } from "@desk/core/types";
import {
  useMeetings,
  useProjects,
  useDeleteMeeting,
  useOpenTab,
  useTabStore,
} from "@/stores";
import { NewMeetingModal } from "./new-meeting-modal";

const ALL_PROJECTS = "all";
const UNASSIGNED = "_unassigned";

interface MeetingsTreePaneProps {
  workspaceId: string;
  /** Seeds the project filter (e.g. from a project overview quick-link). */
  initialProjectFilter?: string;
}

interface MonthGroup {
  key: string;
  label: string;
  meetings: Meeting[];
}

function groupByMonth(meetings: Meeting[], dir: "asc" | "desc", noDateLabel: string): MonthGroup[] {
  // Undated meetings form one trailing group, regardless of sort direction.
  const dated = meetings.filter((m) => m.date);
  const undated = meetings.filter((m) => !m.date);
  const sorted = [...dated].sort((a, b) => {
    const cmp = a.date!.localeCompare(b.date!);
    return dir === "asc" ? cmp : -cmp;
  });
  const groups = new Map<string, Meeting[]>();
  for (const m of sorted) {
    const key = m.date!.slice(0, 7); // YYYY-MM, stable without parsing
    const bucket = groups.get(key);
    if (bucket) bucket.push(m);
    else groups.set(key, [m]);
  }
  const result = Array.from(groups.entries()).map(([key, ms]) => ({
    key,
    label: safeFormat(ms[0].date, "MMMM yyyy"),
    meetings: ms,
  }));
  if (undated.length > 0) {
    result.push({ key: "no-date", label: noDateLabel, meetings: undated });
  }
  return result;
}

export function MeetingsTreePane({ workspaceId, initialProjectFilter }: MeetingsTreePaneProps) {
  const { t } = useTranslation();
  const { data: meetings = [] } = useMeetings(workspaceId);
  const { data: projects = [] } = useProjects(workspaceId);
  const { openMeeting } = useOpenTab();
  const deleteMeeting = useDeleteMeeting();

  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const activeMeetingId =
    activeTab?.type === "meeting" && activeTab.entityId ? activeTab.entityId : null;

  const [searchQuery, setSearchQuery] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [projectFilter, setProjectFilter] = useState<string>(
    initialProjectFilter ?? ALL_PROJECTS,
  );

  const [newMeetingOpen, setNewMeetingOpen] = useState(false);

  const projectsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );

  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      if (projectFilter === UNASSIGNED) {
        if (m.projectId) return false;
      } else if (projectFilter !== ALL_PROJECTS) {
        if (m.projectId !== projectFilter) return false;
      }
      return matchesSearch(searchQuery, m.title, m.content);
    });
  }, [meetings, projectFilter, searchQuery]);

  const groups = useMemo(
    () => groupByMonth(filtered, sortDir, t("pages.meetings.groups.noDate")),
    [filtered, sortDir, t],
  );

  // Most recent *dated* meeting in the current filter scope — anchors the "Latest" pill.
  const latestId = useMemo(() => {
    const dated = filtered.filter((m) => m.date);
    if (dated.length === 0) return null;
    return dated.reduce((acc, m) => (m.date! > acc.date! ? m : acc), dated[0]).id;
  }, [filtered]);

  const handleOpenMeeting = useCallback((meeting: Meeting) => openMeeting(meeting), [openMeeting]);

  const handleDelete = useCallback(
    async (meeting: Meeting) => {
      try {
        await deleteMeeting.mutateAsync({
          meetingId: meeting.id,
          workspaceId: meeting.workspaceId,
          projectId: meeting.projectId,
        });
        toast.success(t("toasts.meeting.deleted"));
      } catch (err) {
        console.error("Failed to delete meeting:", err);
        toast.error(t("errors.meeting.deleteFailed"));
      }
    },
    [deleteMeeting, t],
  );

  const showProjectTag = projectFilter === ALL_PROJECTS;

  const sortOptions: ListPaneSortOption[] = [
    {
      key: "desc",
      label: t("pages.meetings.tree.sort.newestFirst"),
      icon: ArrowDown01,
      active: sortDir === "desc",
      onSelect: () => setSortDir("desc"),
    },
    {
      key: "asc",
      label: t("pages.meetings.tree.sort.oldestFirst"),
      icon: ArrowUp01,
      active: sortDir === "asc",
      onSelect: () => setSortDir("asc"),
    },
  ];

  return (
    <>
      <ListPane
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        sortOptions={sortOptions}
        menuItems={
          <DropdownMenuItem onClick={() => setNewMeetingOpen(true)}>
            <Plus className="size-4 mr-2" />
            {t("pages.meetings.tree.actions.newMeeting")}
          </DropdownMenuItem>
        }
        filter={
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger size="xs" className="h-7 w-full text-xs">
              <SelectValue placeholder={t("pages.meetings.tree.filter.allProjects")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROJECTS}>
                {t("pages.meetings.tree.filter.allProjects")}
              </SelectItem>
              <SelectItem value={UNASSIGNED}>
                {t("pages.meetings.tree.filter.noProject")}
              </SelectItem>
              {sortedProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        countLabel={t("pages.meetings.tree.meetingCount", { count: filtered.length })}
        action={{
          label: t("pages.meetings.tree.actions.newMeeting"),
          onClick: () => setNewMeetingOpen(true),
        }}
      >
        {filtered.length === 0 ? (
          <StatePanel
            variant="empty"
            display="inline"
            className="py-8"
            title={
              searchQuery.trim()
                ? t("pages.meetings.tree.emptyMatching")
                : t("pages.meetings.tree.emptyAll")
            }
          />
        ) : (
          groups.map((group) => (
            <div key={group.key} className="mb-1">
              <SectionLabel sticky>{group.label}</SectionLabel>
              {group.meetings.map((meeting) => {
                const isLatest = meeting.id === latestId;
                const projectName = meeting.projectId
                  ? (projectsById.get(meeting.projectId) ?? null)
                  : null;
                const showSecondLine = showProjectTag && !!projectName;
                return (
                  <ListRow
                    key={meeting.id}
                    isActive={meeting.id === activeMeetingId}
                    onClick={() => handleOpenMeeting(meeting)}
                    leading={
                      <Calendar
                        className={cn(
                          "size-3.5 shrink-0",
                          showSecondLine && "mt-0.5",
                          isLatest ? "text-brand-accent" : "text-muted-foreground",
                        )}
                      />
                    }
                    title={meeting.title}
                    meta={safeFormat(meeting.date, "MMM d")}
                    secondLine={showSecondLine ? projectName : undefined}
                    menuItems={
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(meeting);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 mr-2" />
                        {t("common.buttons.delete")}
                      </DropdownMenuItem>
                    }
                  />
                );
              })}
            </div>
          ))
        )}
      </ListPane>

      <NewMeetingModal
        open={newMeetingOpen}
        onClose={() => setNewMeetingOpen(false)}
        defaultProjectId={
          projectFilter !== ALL_PROJECTS && projectFilter !== UNASSIGNED ? projectFilter : undefined
        }
      />
    </>
  );
}
