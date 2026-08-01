import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Calendar, CheckSquare, FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime, safeFormat } from "@/lib/i18n/format";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionLabel, ListRow } from "@/components/patterns";
import { AIBadge } from "@/components/ui/ai-badge";
import { TaskListView } from "@/components/tasks/task-list-view";
import { NewMeetingModal } from "@/components/meetings/new-meeting-modal";
import {
  useProjectTasks,
  useProjectMeetings,
  useContentTree,
  useCreateTask,
  useOpenTab,
} from "@/stores";
import { extractDocs, compareDatesDesc } from "@desk/core";
import type { TaskStatus } from "@desk/core/types";
import { isActiveStatus } from "@/lib/task-status";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

const TASK_CAP = 7;
const ACTIVITY_CAP = 10;
const NO_HIDDEN_STATUSES = new Set<TaskStatus>();

function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-[11px] text-muted-foreground hover:text-foreground">
      {children}
    </Link>
  );
}

export function TasksSection({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { t } = useTranslation();
  const { data: tasks = [], isLoading } = useProjectTasks(workspaceId, projectId);
  const { openTask } = useOpenTab();
  const createTask = useCreateTask();
  const [newTitle, setNewTitle] = useState("");

  const activeTasks = useMemo(() => tasks.filter((task) => isActiveStatus(task.status)), [tasks]);
  const shown = activeTasks.slice(0, TASK_CAP);
  const moreCount = activeTasks.length - shown.length;
  const boardLink = `/tasks?project=${projectId}`;

  const handleQuickAdd = async (event: FormEvent) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || createTask.isPending) return;
    try {
      await createTask.mutateAsync({ workspaceId, projectId, title });
      setNewTitle("");
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error(t("errors.task.createFailed"));
    }
  };

  return (
    <section>
      <SectionLabel
        className="mb-2"
        end={<SectionLink to={boardLink}>{t("pages.projects.home.openBoard")}</SectionLink>}
      >
        {t("pages.projects.home.tasksHeading")}
      </SectionLabel>

      {!isLoading && shown.length === 0 ? (
        <EmptyState
          display="inline"
          className="py-6"
          title={t("pages.projects.home.noActiveTasks")}
        />
      ) : (
        <TaskListView
          tasks={shown}
          onTaskClick={(task) => openTask(task)}
          groupByStatus={false}
          hiddenStatuses={NO_HIDDEN_STATUSES}
          isLoading={isLoading}
        />
      )}

      {moreCount > 0 && (
        <Link
          to={boardLink}
          className="inline-block mt-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("pages.projects.home.moreOnBoard", { count: moreCount })}
        </Link>
      )}

      <form onSubmit={handleQuickAdd} className="mt-3">
        <div className="relative">
          <Plus className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder={t("pages.projects.home.quickAddPlaceholder")}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </form>
    </section>
  );
}

export function MeetingsSection({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { t } = useTranslation();
  const { data: meetings = [], isLoading } = useProjectMeetings(workspaceId, projectId);
  const { openMeeting } = useOpenTab();
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);

  const recent = useMemo(
    () => [...meetings].sort((a, b) => compareDatesDesc(a.date, b.date)).slice(0, 3),
    [meetings],
  );

  return (
    <section>
      <SectionLabel
        className="mb-1"
        end={
          <>
            <button
              type="button"
              onClick={() => setNewMeetingOpen(true)}
              className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3" />
              {t("pages.projects.home.newMeeting")}
            </button>
            <span className="text-muted-foreground/40">·</span>
            <SectionLink to={`/meetings?project=${projectId}`}>
              {t("pages.projects.home.allMeetings")}
            </SectionLink>
          </>
        }
      >
        {t("pages.projects.home.meetingsHeading")}
      </SectionLabel>

      {isLoading ? (
        <LoadingSkeleton variant="list" rows={3} className="py-1" />
      ) : recent.length === 0 ? (
        <EmptyState
          display="inline"
          className="py-6"
          title={t("pages.projects.home.noMeetings")}
        />
      ) : (
        <div className="-mx-4">
          {recent.map((meeting) => (
            <ListRow
              key={meeting.id}
              onClick={() => openMeeting(meeting)}
              leading={<Calendar className="size-3.5 shrink-0 text-muted-foreground" />}
              title={
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{meeting.title}</span>
                  {meeting.author === "ai" && <AIBadge />}
                </span>
              }
              meta={safeFormat(meeting.date, "MMM d")}
            />
          ))}
        </div>
      )}

      <NewMeetingModal
        open={newMeetingOpen}
        onClose={() => setNewMeetingOpen(false)}
        defaultProjectId={projectId}
      />
    </section>
  );
}

export function DocsSection({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { t } = useTranslation();
  const { data: tree = [], isLoading } = useContentTree("project", workspaceId, projectId);
  const { openDoc } = useOpenTab();

  const recent = useMemo(
    () =>
      extractDocs(tree)
        .sort((a, b) => compareDatesDesc(a.created, b.created))
        .slice(0, 5),
    [tree],
  );

  return (
    <section>
      <SectionLabel
        className="mb-1"
        end={
          <SectionLink to={`/docs?project=${projectId}`}>
            {t("pages.projects.home.allDocs")}
          </SectionLink>
        }
      >
        {t("pages.projects.home.docsHeading")}
      </SectionLabel>

      {isLoading ? (
        <LoadingSkeleton variant="list" rows={4} className="py-1" />
      ) : recent.length === 0 ? (
        <EmptyState display="inline" className="py-6" title={t("pages.projects.home.noDocs")} />
      ) : (
        <div className="-mx-4">
          {recent.map((doc) => (
            <ListRow
              key={doc.id}
              onClick={() => openDoc(doc)}
              leading={<FileText className="size-3.5 shrink-0 text-muted-foreground" />}
              title={
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{doc.title}</span>
                  {doc.author === "ai" && <AIBadge />}
                </span>
              }
              meta={safeFormat(doc.created, "MMM d")}
            />
          ))}
        </div>
      )}
    </section>
  );
}

const activityIcons = {
  task: CheckSquare,
  meeting: Calendar,
  doc: FileText,
} as const;

type ActivityKind = keyof typeof activityIcons;

interface ActivityItem {
  kind: ActivityKind;
  id: string;
  title: string;
  stamp: string;
  open: () => void;
}

/**
 * Recent-activity feed: the project's most recently saved items, keyed off the
 * `updated` frontmatter stamp (falling back to `created` for files that predate
 * it). Items with neither are excluded — the feed shows real activity only.
 */
export function ActivitySection({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { t } = useTranslation();
  const { data: tasks = [], isLoading: tasksLoading } = useProjectTasks(workspaceId, projectId);
  const { data: meetings = [], isLoading: meetingsLoading } = useProjectMeetings(workspaceId, projectId);
  const { data: tree = [], isLoading: docsLoading } = useContentTree("project", workspaceId, projectId);
  const { openTask, openMeeting, openDoc } = useOpenTab();

  const recent = useMemo(() => {
    const items: ActivityItem[] = [];
    const push = (
      kind: ActivityKind,
      item: { id: string; title: string; updated?: string; created?: string },
      open: () => void,
    ) => {
      const stamp = item.updated ?? item.created;
      if (stamp) items.push({ kind, id: item.id, title: item.title, stamp, open });
    };

    for (const task of tasks) push("task", task, () => openTask(task));
    for (const meeting of meetings) push("meeting", meeting, () => openMeeting(meeting));
    for (const doc of extractDocs(tree)) push("doc", doc, () => openDoc(doc));

    items.sort((a, b) => compareDatesDesc(a.stamp, b.stamp));
    return items.slice(0, ACTIVITY_CAP);
  }, [tasks, meetings, tree, openTask, openMeeting, openDoc]);

  return (
    <section>
      <SectionLabel className="mb-1">{t("pages.projects.home.activityHeading")}</SectionLabel>
      {tasksLoading || meetingsLoading || docsLoading ? (
        <LoadingSkeleton variant="list" rows={5} className="py-1" />
      ) : recent.length === 0 ? (
        <EmptyState
          display="inline"
          className="py-6"
          title={t("pages.projects.home.noActivity")}
        />
      ) : (
        <div className="-mx-4">
          {recent.map((item) => {
            const Icon = activityIcons[item.kind];
            return (
              <ListRow
                key={`${item.kind}:${item.id}`}
                onClick={item.open}
                leading={<Icon className="size-3.5 shrink-0 text-muted-foreground" />}
                title={item.title}
                meta={formatRelativeTime(item.stamp)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
