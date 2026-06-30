
import type { ReactNode } from "react";
import { Circle, Minus, FolderKanban } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/lib/utils";
import type { TaskStatus, TaskPriority } from "@desk/core/types";
import {
  priorityMeta,
  priorityOrder,
  taskStatusTextColors,
  taskStatusLabels,
  taskStatusOrder,
} from "@/lib/design-tokens";

/** Shared chip styling so every metadata field is visually identical. */
const chipClass =
  "border-none bg-transparent shadow-none px-1.5 gap-1.5 text-xs font-medium hover:bg-accent/50 rounded-md";

interface MetadataToolbarProps {
  // Task-specific fields
  status?: TaskStatus;
  onStatusChange?: (status: TaskStatus) => void;
  priority?: TaskPriority | "none";
  onPriorityChange?: (priority: TaskPriority | "none") => void;

  // Common fields
  projectId?: string;
  onProjectChange?: (projectId: string) => void;
  projects?: { id: string; name: string }[];
  /** Render the project as a static, non-editable chip (e.g. docs, whose moves happen in the tree). */
  projectReadOnly?: boolean;
  /** Explicit label for the read-only chip (covers workspace-level / unassigned, which aren't in `projects`). */
  projectLabel?: string;

  // Date field (for tasks = due date, for meetings = meeting date)
  date?: string;
  onDateChange?: (date: string) => void;
  dateLabel?: string;

  className?: string;
}

export function MetadataToolbar({
  status,
  onStatusChange,
  priority,
  onPriorityChange,
  projectId,
  onProjectChange,
  projects = [],
  projectReadOnly,
  projectLabel,
  date,
  onDateChange,
  dateLabel = "Due",
  className,
}: MetadataToolbarProps) {
  const { t } = useTranslation();
  const selectedProject = projects.find((p) => p.id === projectId);

  const fields: ReactNode[] = [];

  if (status !== undefined && onStatusChange) {
    fields.push(
      <Select key="status" value={status} onValueChange={(v) => onStatusChange(v as TaskStatus)}>
        <SelectTrigger size="xs" className={chipClass}>
          <span className="flex items-center gap-1.5">
            <Circle className={cn("h-2.5 w-2.5 fill-current", taskStatusTextColors[status])} />
            <span>{taskStatusLabels[status]}</span>
          </span>
        </SelectTrigger>
        <SelectContent>
          {taskStatusOrder.map((s) => (
            <SelectItem key={s} value={s}>
              <span className="flex items-center gap-2">
                <Circle className={cn("h-3 w-3 fill-current", taskStatusTextColors[s])} />
                {taskStatusLabels[s]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (priority !== undefined && onPriorityChange) {
    const current = priority !== "none" ? priorityMeta[priority] : null;
    const CurrentIcon = current?.icon ?? Minus;
    fields.push(
      <Select
        key="priority"
        value={priority}
        onValueChange={(v) => onPriorityChange(v as TaskPriority | "none")}
      >
        <SelectTrigger size="xs" className={chipClass}>
          <span className={cn(
            "flex items-center gap-1.5",
            current ? current.color : "text-muted-foreground"
          )}>
            <CurrentIcon className="h-3.5 w-3.5" />
            <span>{current ? current.label : t("ui.metadataToolbar.none")}</span>
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("ui.metadataToolbar.none")}</SelectItem>
          {priorityOrder.map((p) => {
            const { label, icon: Icon, color } = priorityMeta[p];
            return (
              <SelectItem key={p} value={p}>
                <span className={cn("flex items-center gap-2", color)}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }

  if (projectId !== undefined && projectReadOnly) {
    // Static location chip — moves happen via the docs tree (drag-drop / context menu).
    fields.push(
      <span
        key="project"
        className={cn(chipClass, "inline-flex items-center max-w-[180px] cursor-default")}
      >
        <FolderKanban className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
        <span className="truncate">
          {projectLabel ?? selectedProject?.name ?? t("ui.metadataToolbar.noProject")}
        </span>
      </span>
    );
  } else if (projectId !== undefined && onProjectChange) {
    fields.push(
      <Select key="project" value={projectId} onValueChange={onProjectChange}>
        <SelectTrigger size="xs" className={cn(chipClass, "max-w-[180px]")}>
          <FolderKanban className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
          <span className="truncate">
            {selectedProject?.name || t("ui.metadataToolbar.noProject")}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_unassigned">
            <span className="flex items-center gap-2">
              <FolderKanban className="h-3 w-3 text-muted-foreground" />
              {t("ui.metadataToolbar.noProject")}
            </span>
          </SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <span className="flex items-center gap-2">
                <FolderKanban className="h-3 w-3 text-muted-foreground" />
                {p.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (date !== undefined && onDateChange) {
    const isDue = dateLabel === "Due";
    fields.push(
      <DateField
        key="date"
        variant="chip"
        value={date}
        onChange={onDateChange}
        placeholder={isDue ? t("ui.metadataToolbar.addDueDate") : t("ui.metadataToolbar.addDate")}
        clearable={isDue}
      />
    );
  }

  if (fields.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1 -ml-1.5", className)}>
      {fields}
    </div>
  );
}
