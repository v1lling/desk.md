import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLocaleDate } from "@/lib/i18n/format";
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
import type { Project, ProjectStatus, ProjectUpdate } from "@desk/core/types";
import { projectStatusDotColors, projectStatuses, taskStatusColors } from "@/lib/design-tokens";
import { countActiveTasks } from "@/lib/task-status";

interface ProjectHomeHeaderProps {
  project: Project;
  onUpdate: (updates: ProjectUpdate) => Promise<void>;
  onDeleteRequest: () => void;
}

export function ProjectHomeHeader({
  project,
  onUpdate,
  onDeleteRequest,
}: ProjectHomeHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <InlineName value={project.name} onSave={(name) => onUpdate({ name })} />
        </div>
        <Select
          value={project.status}
          onValueChange={(status) => onUpdate({ status: status as ProjectStatus })}
        >
          <SelectTrigger
            size="sm"
            className="shrink-0 border-0 bg-transparent shadow-none text-muted-foreground hover:text-foreground hover:bg-accent/60 focus-visible:ring-0"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {projectStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", projectStatusDotColors[status])} />
                  {t(`entities.project.status.${status}`)}
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
              onClick={onDeleteRequest}
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
        onSave={(description) => onUpdate({ description: description || null })}
      />
      <TaskCounts project={project} />
    </div>
  );
}

/** Click-to-edit project name — preserves rename now that the Edit modal is gone. */
function InlineName({ value, onSave }: { value: string; onSave: (value: string) => void }) {
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
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
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
function InlineDescription({
  value,
  onSave,
}: {
  value: string;
  onSave: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
  };

  if (editing) {
    return (
      <Textarea
        ref={textareaRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
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
      <span>
        {t("pages.projects.home.createdOn", {
          date: formatLocaleDate(project.created, {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
        })}
      </span>
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
