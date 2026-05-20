
import type { ReactNode } from "react";
import { Circle, Flag, FolderKanban } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/lib/utils";
import type { TaskStatus, TaskPriority } from "@/types";
import { priorityTextColors, taskStatusTextColors, taskStatusLabels, taskStatusOrder } from "@/lib/design-tokens";

const priorityConfig: Record<TaskPriority, { label: string; color: string }> = {
  high: { label: "High", color: priorityTextColors.high },
  medium: { label: "Medium", color: priorityTextColors.medium },
  low: { label: "Low", color: priorityTextColors.low },
};

const priorityOptions: TaskPriority[] = ["high", "medium", "low"];

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
  date,
  onDateChange,
  dateLabel = "Due",
  className,
}: MetadataToolbarProps) {
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
    fields.push(
      <Select
        key="priority"
        value={priority}
        onValueChange={(v) => onPriorityChange(v as TaskPriority | "none")}
      >
        <SelectTrigger size="xs" className={chipClass}>
          <span className={cn(
            "flex items-center gap-1.5",
            priority !== "none" ? priorityConfig[priority as TaskPriority].color : "text-muted-foreground"
          )}>
            <Flag className="h-2.5 w-2.5" />
            <span>{priority !== "none" ? priorityConfig[priority as TaskPriority].label : "None"}</span>
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {priorityOptions.map((p) => (
            <SelectItem key={p} value={p}>
              <span className={cn("flex items-center gap-2", priorityConfig[p].color)}>
                <Flag className="h-3 w-3" />
                {priorityConfig[p].label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (projectId !== undefined && onProjectChange) {
    fields.push(
      <Select key="project" value={projectId} onValueChange={onProjectChange}>
        <SelectTrigger size="xs" className={cn(chipClass, "max-w-[180px]")}>
          <FolderKanban className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
          <span className="truncate">
            {selectedProject?.name || "No project"}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_unassigned">
            <span className="flex items-center gap-2">
              <FolderKanban className="h-3 w-3 text-muted-foreground" />
              No project
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
        placeholder={isDue ? "Add due date" : "Add date"}
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
