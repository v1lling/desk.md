import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowDown01,
  ArrowUp01,
  Calendar,
  ChevronsUpDown,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Meeting } from "@/types";
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

function groupByMonth(meetings: Meeting[], dir: "asc" | "desc"): MonthGroup[] {
  const sorted = [...meetings].sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    return dir === "asc" ? cmp : -cmp;
  });
  const groups = new Map<string, Meeting[]>();
  for (const m of sorted) {
    const key = m.date.slice(0, 7); // YYYY-MM, stable without parsing
    const bucket = groups.get(key);
    if (bucket) bucket.push(m);
    else groups.set(key, [m]);
  }
  return Array.from(groups.entries()).map(([key, ms]) => ({
    key,
    label: safeFormat(ms[0].date, "MMMM yyyy"),
    meetings: ms,
  }));
}

function safeFormat(iso: string, pattern: string): string {
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return "";
  }
}

export function MeetingsTreePane({ workspaceId, initialProjectFilter }: MeetingsTreePaneProps) {
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
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    const q = searchQuery.trim().toLowerCase();
    return meetings.filter((m) => {
      if (projectFilter === UNASSIGNED) {
        if (m.projectId) return false;
      } else if (projectFilter !== ALL_PROJECTS) {
        if (m.projectId !== projectFilter) return false;
      }
      if (q) {
        if (!m.title.toLowerCase().includes(q) && !m.content?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [meetings, projectFilter, searchQuery]);

  const groups = useMemo(() => groupByMonth(filtered, sortDir), [filtered, sortDir]);

  // Most recent meeting *in the current filter scope* — anchors the "Latest" pill.
  // When sort is asc (oldest-first), the latest is the last item of the last group;
  // for desc it's the first item of the first group.
  const latestId = useMemo(() => {
    if (filtered.length === 0) return null;
    return filtered.reduce((acc, m) => (m.date > acc.date ? m : acc), filtered[0]).id;
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
        toast.success("Meeting deleted");
      } catch (err) {
        console.error("Failed to delete meeting:", err);
        toast.error("Failed to delete meeting");
      }
    },
    [deleteMeeting],
  );

  const showProjectTag = projectFilter === ALL_PROJECTS;

  return (
    <div className="flex flex-col h-full">
      {/* Header: search + sort + more */}
      <div className="shrink-0 min-h-11 py-2 px-3 border-b border-border/60 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchQuery("");
            }}
            className="h-7 pl-7 pr-7 text-xs"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-1/2 -translate-y-1/2 size-6 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              title="Sort"
            >
              <ChevronsUpDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => setSortDir("desc")}
              className={cn(sortDir === "desc" && "bg-accent")}
            >
              <ArrowDown01 className="size-4 mr-2" />
              Newest first
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortDir("asc")}
              className={cn(sortDir === "asc" && "bg-accent")}
            >
              <ArrowUp01 className="size-4 mr-2" />
              Oldest first
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setNewMeetingOpen(true)}>
              <Plus className="size-4 mr-2" />
              New Meeting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Project filter */}
      <div className="shrink-0 px-3 py-2 border-b border-border/40">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger size="xs" className="h-7 w-full text-xs">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
            <SelectItem value={UNASSIGNED}>No project</SelectItem>
            {sortedProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Action row: count + new meeting */}
      <div className="shrink-0 px-3 py-1 flex items-center gap-2 border-b border-border/40">
        <span className="text-xs text-muted-foreground tabular-nums">
          {filtered.length} {filtered.length === 1 ? "meeting" : "meetings"}
        </span>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setNewMeetingOpen(true)}
        >
          <Plus className="size-3.5 mr-1" />
          New Meeting
        </Button>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-xs text-muted-foreground text-center">
              {searchQuery.trim() ? "No matching meetings." : "No meetings yet."}
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.key} className="mb-1">
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  {group.label}
                </div>
                {group.meetings.map((meeting) => {
                  const isActive = meeting.id === activeMeetingId;
                  const isLatest = meeting.id === latestId;
                  const projectName = meeting.projectId
                    ? (projectsById.get(meeting.projectId) ?? null)
                    : null;
                  const showSecondLine = showProjectTag && !!projectName;
                  return (
                    <div
                      key={meeting.id}
                      className={cn(
                        "group flex items-start gap-2 px-3 py-1.5 cursor-pointer rounded-sm mx-1",
                        "hover:bg-accent/40",
                        isActive && "bg-accent",
                      )}
                      onClick={() => handleOpenMeeting(meeting)}
                    >
                      <Calendar
                        className={cn(
                          "size-3.5 shrink-0 mt-0.5",
                          isLatest ? "text-brand-accent" : "text-muted-foreground",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm truncate flex-1">{meeting.title}</span>
                          <span className="text-[11px] text-muted-foreground/70 tabular-nums shrink-0">
                            {safeFormat(meeting.date, "MMM d")}
                          </span>
                        </div>
                        {showSecondLine && (
                          <div className="text-[11px] text-muted-foreground/70 truncate">
                            {projectName}
                          </div>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground mt-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDelete(meeting);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <NewMeetingModal
        open={newMeetingOpen}
        onClose={() => setNewMeetingOpen(false)}
        defaultProjectId={
          projectFilter !== ALL_PROJECTS && projectFilter !== UNASSIGNED ? projectFilter : undefined
        }
      />
    </div>
  );
}
