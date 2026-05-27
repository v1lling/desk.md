import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Calendar, CheckSquare, FileText, FolderKanban, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatLocaleDate } from "@/lib/i18n/format";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatePanel } from "@/components/ui/state-panel";
import { useProject, useUpdateProject } from "@/stores";
import type { Project, ProjectStatus } from "@/types";
import { taskStatusLabels, taskStatusOrder, taskStatusTextColors } from "@/lib/design-tokens";

const statusValues: ProjectStatus[] = ["active", "paused", "completed", "archived"];

const statusDotColors: Record<ProjectStatus, string> = {
  active: "bg-emerald-500",
  paused: "bg-amber-500",
  completed: "bg-blue-500",
  archived: "bg-slate-400",
};

function safeFormatDate(iso: string): string {
  return formatLocaleDate(iso, { day: "numeric", month: "short", year: "numeric" });
}

interface ProjectOverviewProps {
  workspaceId: string;
  projectId: string;
}

export function ProjectOverview({ workspaceId, projectId }: ProjectOverviewProps) {
  const { t } = useTranslation();
  const { data: project, isLoading } = useProject(workspaceId, projectId);
  const updateProject = useUpdateProject();

  const handleUpdate = async (
    updates: Partial<Pick<Project, "name" | "status" | "description">>,
  ) => {
    try {
      await updateProject.mutateAsync({ projectId, workspaceId, updates });
    } catch (err) {
      console.error("Failed to update project:", err);
      toast.error(t("toasts.project.update.error"));
    }
  };

  if (isLoading) {
    return <StatePanel variant="loading" title={t("pages.projects.overview.loading")} className="h-full" />;
  }
  if (!project) {
    return (
      <StatePanel
        variant="notFound"
        icon={FolderKanban}
        title={t("pages.projects.overview.notFoundTitle")}
        description={t("pages.projects.overview.notFoundDescription")}
        className="h-full"
      />
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl px-8 py-8 space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <FolderKanban className="size-7 shrink-0 text-muted-foreground mt-1" />
            <div className="min-w-0 flex-1">
              <InlineName value={project.name} onSave={(name) => handleUpdate({ name })} />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("pages.projects.overview.createdOn", { date: safeFormatDate(project.created) })}
              </p>
            </div>
            <Select
              value={project.status}
              onValueChange={(v) => handleUpdate({ status: v as ProjectStatus })}
            >
              <SelectTrigger className="w-[150px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusValues.map((value) => (
                  <SelectItem key={value} value={value}>
                    <span className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", statusDotColors[value])} />
                      {t(`entities.project.status.${value}`)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <InlineDescription
            value={project.description ?? ""}
            onSave={(description) => handleUpdate({ description })}
          />
        </div>

        {/* Task stats */}
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70 mb-2">
            {t("pages.projects.overview.tasksHeading")}
          </h2>
          <div className="grid grid-cols-5 gap-2">
            {taskStatusOrder.map((status) => (
              <Card key={status} className="py-3 gap-0.5 items-center">
                <span
                  className={cn(
                    "text-xl font-semibold tabular-nums",
                    taskStatusTextColors[status],
                  )}
                >
                  {project.tasksByStatus?.[status] ?? 0}
                </span>
                <span className="text-[11px] text-muted-foreground text-center">
                  {taskStatusLabels[status]}
                </span>
              </Card>
            ))}
          </div>
          <ProgressBar tasksByStatus={project.tasksByStatus} />
        </div>

        {/* Quick links */}
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70 mb-2">
            {t("pages.projects.overview.openHeading")}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <QuickLink
              to={`/tasks?project=${projectId}`}
              icon={CheckSquare}
              label={t("pages.projects.overview.quickLinks.tasks")}
              count={project.taskCount ?? 0}
            />
            <QuickLink
              to="/docs"
              icon={FileText}
              label={t("pages.projects.overview.quickLinks.docs")}
              count={project.docCount ?? 0}
            />
            <QuickLink
              to={`/meetings?project=${projectId}`}
              icon={Calendar}
              label={t("pages.projects.overview.quickLinks.meetings")}
              count={project.meetingCount ?? 0}
            />
          </div>
        </div>
      </div>
    </ScrollArea>
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
        className="h-auto py-0.5 px-1.5 -mx-1.5 text-2xl font-semibold tracking-tight"
      />
    );
  }
  return (
    <h1
      className="text-2xl font-semibold tracking-tight cursor-text rounded px-1.5 -mx-1.5 py-0.5 hover:bg-accent/60 truncate"
      title={t("pages.projects.overview.renameTitle")}
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
        placeholder={t("pages.projects.overview.descriptionPlaceholder")}
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
      title={t("pages.projects.overview.descriptionEditTitle")}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      {value || t("pages.projects.overview.descriptionPlaceholder")}
    </p>
  );
}

function ProgressBar({ tasksByStatus }: { tasksByStatus?: Project["tasksByStatus"] }) {
  const { t } = useTranslation();
  const total = tasksByStatus
    ? tasksByStatus.backlog +
      tasksByStatus.todo +
      tasksByStatus.doing +
      tasksByStatus.waiting +
      tasksByStatus.done
    : 0;
  const done = tasksByStatus?.done ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
        <span>{t("pages.projects.overview.progress")}</span>
        <span className="tabular-nums">
          {total === 0
            ? t("pages.projects.overview.noTasksYet")
            : t("pages.projects.overview.progressSummary", { done, total, pct })}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
  count,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  count: number;
}) {
  return (
    <Link to={to} className="block">
      <Card className="py-3.5 gap-0 hover:bg-accent/40 transition-colors">
        <div className="flex items-center gap-2.5 px-4">
          <Icon className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium flex-1">{label}</span>
          <span className="text-sm tabular-nums text-muted-foreground">{count}</span>
        </div>
      </Card>
    </Link>
  );
}
