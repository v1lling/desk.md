import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Calendar,
  CheckSquare,
  FileText,
  FolderKanban,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatLocaleDate, formatRelativeTime, safeFormat } from "@/lib/i18n/format";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatePanel } from "@/components/ui/state-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionLabel, ListRow } from "@/components/patterns";
import { ContextSection } from "@/components/context";
import { TaskListView } from "@/components/tasks/task-list-view";
import { NewMeetingModal } from "@/components/meetings/new-meeting-modal";
import {
  useProject,
  useUpdateProject,
  useDeleteProject,
  useProjectTasks,
  useProjectMeetings,
  useContentTree,
  useCreateTask,
  useOpenTab,
} from "@/stores";
import { useProjectSelectionStore } from "@/stores/project-selection";
import { extractDocs, compareDatesDesc } from "@desk/core";
import type { Project, ProjectStatus, ProjectUpdate, TaskStatus } from "@desk/core/types";
import { projectStatusDotColors, projectStatuses, taskStatusColors } from "@/lib/design-tokens";
import { isActiveStatus, countActiveTasks } from "@/lib/task-status";

const TASK_CAP = 7;
const NO_HIDDEN_STATUSES = new Set<TaskStatus>();

function safeFormatDate(iso: string): string {
  return formatLocaleDate(iso, { day: "numeric", month: "short", year: "numeric" });
}

interface ProjectHomeProps {
  workspaceId: string;
  projectId: string;
}

/**
 * The project's home: header (name, description, status, task counts), the Context panel,
 * active tasks with quick-add, recent meetings, recent docs, and the recent-activity feed
 * driven by the `updated` frontmatter stamp.
 *
 * Context sits above the work on purpose — orientation comes before the to-do list.
 */
export function ProjectHome({ workspaceId, projectId }: ProjectHomeProps) {
  const { t } = useTranslation();
  const { data: project, isLoading } = useProject(workspaceId, projectId);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const setSelectedProject = useProjectSelectionStore((s) => s.setSelectedProject);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleUpdate = async (updates: ProjectUpdate) => {
    try {
      await updateProject.mutateAsync({ projectId, workspaceId, updates });
    } catch (err) {
      console.error("Failed to update project:", err);
      toast.error(t("toasts.project.update.error"));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProject.mutateAsync({ projectId, workspaceId });
      setSelectedProject(null);
      toast.success(t("toasts.project.delete.success"));
    } catch (err) {
      console.error("Failed to delete project:", err);
      toast.error(t("toasts.project.delete.error"));
    }
  };

  if (isLoading) {
    return <StatePanel variant="loading" title={t("pages.projects.home.loading")} className="h-full" />;
  }
  if (!project) {
    return (
      <StatePanel
        variant="notFound"
        icon={FolderKanban}
        title={t("pages.projects.home.notFoundTitle")}
        description={t("pages.projects.home.notFoundDescription")}
        className="h-full"
      />
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="mx-auto max-w-3xl px-6 py-6 space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <InlineName value={project.name} onSave={(name) => handleUpdate({ name })} />
              </div>
              <Select
                value={project.status}
                onValueChange={(v) => handleUpdate({ status: v as ProjectStatus })}
              >
                <SelectTrigger
                  size="sm"
                  className="shrink-0 border-0 bg-transparent shadow-none text-muted-foreground hover:text-foreground hover:bg-accent/60 focus-visible:ring-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projectStatuses.map((value) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", projectStatusDotColors[value])} />
                        {t(`entities.project.status.${value}`)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setConfirmDelete(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4 mr-2" />
                    {t("pages.projects.home.deleteProject")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <InlineDescription
              value={project.description ?? ""}
              onSave={(description) => handleUpdate({ description: description || null })}
            />
            <TaskCounts project={project} />
          </div>

          <ContextSection project={project} />
          <TasksSection workspaceId={workspaceId} projectId={projectId} />
          <MeetingsSection workspaceId={workspaceId} projectId={projectId} />
          <DocsSection workspaceId={workspaceId} projectId={projectId} />
          <ActivitySection workspaceId={workspaceId} projectId={projectId} />
        </div>
      </ScrollArea>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("pages.projects.deleteConfirmTitle")}
        description={t("pages.projects.deleteConfirmDescription", { name: project.name })}
        confirmLabel={t("common.buttons.delete")}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}

/** Right-aligned link in a SectionLabel's end slot. */
function SectionLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-[11px] text-muted-foreground hover:text-foreground">
      {children}
    </Link>
  );
}

function TasksSection({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  const { t } = useTranslation();
  const { data: tasks = [], isLoading } = useProjectTasks(workspaceId, projectId);
  const { openTask } = useOpenTab();
  const createTask = useCreateTask();
  const [newTitle, setNewTitle] = useState("");

  const activeTasks = useMemo(() => tasks.filter((task) => isActiveStatus(task.status)), [tasks]);
  const shown = activeTasks.slice(0, TASK_CAP);
  const moreCount = activeTasks.length - shown.length;
  const boardLink = `/tasks?project=${projectId}`;

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || createTask.isPending) return;
    try {
      await createTask.mutateAsync({ workspaceId, projectId, title });
      setNewTitle("");
    } catch (err) {
      console.error("Failed to create task:", err);
      toast.error(t("errors.task.createFailed"));
    }
  };

  return (
    <section>
      <SectionLabel className="mb-2" end={<SectionLink to={boardLink}>{t("pages.projects.home.openBoard")}</SectionLink>}>
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
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t("pages.projects.home.quickAddPlaceholder")}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </form>
    </section>
  );
}

function MeetingsSection({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  const { t } = useTranslation();
  const { data: meetings = [] } = useProjectMeetings(workspaceId, projectId);
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

      {recent.length === 0 ? (
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
              title={meeting.title}
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

function DocsSection({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  const { t } = useTranslation();
  const { data: tree = [] } = useContentTree("project", workspaceId, projectId, "doc");
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
        end={<SectionLink to={`/docs?project=${projectId}`}>{t("pages.projects.home.allDocs")}</SectionLink>}
      >
        {t("pages.projects.home.docsHeading")}
      </SectionLabel>

      {recent.length === 0 ? (
        <EmptyState display="inline" className="py-6" title={t("pages.projects.home.noDocs")} />
      ) : (
        <div className="-mx-4">
          {recent.map((doc) => (
            <ListRow
              key={doc.id}
              onClick={() => openDoc(doc)}
              leading={<FileText className="size-3.5 shrink-0 text-muted-foreground" />}
              title={doc.title}
              meta={safeFormat(doc.created, "MMM d")}
            />
          ))}
        </div>
      )}
    </section>
  );
}

const ACTIVITY_CAP = 10;

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
 * it). Items with neither are excluded — the feed shows real activity only,
 * never a fabricated date.
 *
 * Sourced from the same three queries the sections above already mount, so this
 * costs no extra reads and hands real Task/Doc/Meeting objects to the tab opener.
 */
function ActivitySection({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  const { t } = useTranslation();
  const { data: tasks = [] } = useProjectTasks(workspaceId, projectId);
  const { data: meetings = [] } = useProjectMeetings(workspaceId, projectId);
  const { data: tree = [] } = useContentTree("project", workspaceId, projectId, "doc");
  const { openTask, openMeeting, openDoc } = useOpenTab();

  const recent = useMemo(() => {
    const items: ActivityItem[] = [];
    const push = (kind: ActivityKind, item: { id: string; title: string; updated?: string; created?: string }, open: () => void) => {
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
      {recent.length === 0 ? (
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

/** Click-to-edit project name — preserves rename now that the Edit modal is gone. */
function InlineName({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        className="h-auto py-0.5 px-1.5 -mx-1.5 text-lg font-semibold tracking-tight"
      />
    );
  }
  return (
    <h1
      className="text-lg font-semibold tracking-tight cursor-text rounded px-1.5 -mx-1.5 py-0.5 hover:bg-accent/60 truncate"
      title={t("pages.projects.home.renameTitle")}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      {value}
    </h1>
  );
}

/** Click-to-edit short description. Stays a plain-text caption — not a document. */
function InlineDescription({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
  };

  if (editing) {
    return (
      <Textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        placeholder={t("pages.projects.home.descriptionPlaceholder")}
        className="min-h-[60px] resize-none text-sm"
      />
    );
  }
  return (
    <p
      className={cn(
        "text-sm cursor-text rounded px-1.5 -mx-1.5 py-1 hover:bg-accent/60",
        value ? "text-muted-foreground whitespace-pre-wrap" : "text-muted-foreground/50 italic",
      )}
      title={t("pages.projects.home.descriptionEditTitle")}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      {value || t("pages.projects.home.descriptionPlaceholder")}
    </p>
  );
}

/**
 * Task counts, not a completion percentage.
 *
 * The old progress bar was `done / (backlog + todo + doing + waiting + done)`, which made a
 * project look *less* finished the moment you wrote another task down — the denominator was
 * "things I have thought of so far", not "the work". Counts have no denominator, so they cannot
 * lie. `countActiveTasks` is the same signal the sidebar and the projects list already show.
 */
function TaskCounts({ project }: { project: Project }) {
  const { t } = useTranslation();
  const byStatus = project.tasksByStatus;
  const active = countActiveTasks(byStatus);
  const done = byStatus?.done ?? 0;
  const backlog = byStatus?.backlog ?? 0;

  const parts: { key: string; label: string; dot: string }[] = [];
  if (active > 0) {
    parts.push({
      key: "active",
      label: t("pages.projects.home.counts.active", { count: active }),
      dot: taskStatusColors.doing,
    });
  }
  if (done > 0) {
    parts.push({
      key: "done",
      label: t("pages.projects.home.counts.done", { count: done }),
      dot: taskStatusColors.done,
    });
  }
  if (backlog > 0) {
    parts.push({
      key: "backlog",
      label: t("pages.projects.home.counts.backlog", { count: backlog }),
      dot: taskStatusColors.backlog,
    });
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{t("pages.projects.home.createdOn", { date: safeFormatDate(project.created) })}</span>
      {parts.map((part) => (
        <span key={part.key} className="flex items-center gap-1.5">
          <span className="text-muted-foreground/40">·</span>
          <span className={cn("size-1.5 rounded-full", part.dot)} />
          <span className="tabular-nums">{part.label}</span>
        </span>
      ))}
    </div>
  );
}
