
import type { ReactNode } from "react";
import { Circle, Flag, FolderKanban, Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TaskStatus, TaskPriority } from "@/types";
import { priorityTextColors, taskStatusTextColors, taskStatusLabels, taskStatusOrder } from "@/lib/design-tokens";

const priorityConfig: Record<TaskPriority, { label: string; color: string }> = {
  high: { label: "High", color: priorityTextColors.high },
  medium: { label: "Medium", color: priorityTextColors.medium },
  low: { label: "Low", color: priorityTextColors.low },
};

const priorityOptions: TaskPriority[] = ["high", "medium", "low"];

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

  // Meeting-specific
  attendees?: string;
  onAttendeesChange?: (attendees: string) => void;

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
  attendees,
  onAttendeesChange,
  className,
}: MetadataToolbarProps) {
  const selectedProject = projects.find((p) => p.id === projectId);

  // Collect visible fields for dot separator logic
  const fields: ReactNode[] = [];

  if (status !== undefined && onStatusChange) {
    fields.push(
      <div key="status" className="flex items-center">
        <Select value={status} onValueChange={(v) => onStatusChange(v as TaskStatus)}>
          <SelectTrigger size="xs" className="border-none bg-transparent shadow-none px-1.5 gap-1.5 text-xs font-medium hover:bg-accent/50 rounded-md">
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
      </div>
    );
  }

  if (priority !== undefined && onPriorityChange) {
    fields.push(
      <div key="priority" className="flex items-center">
        <Select
          value={priority}
          onValueChange={(v) => onPriorityChange(v as TaskPriority | "none")}
        >
          <SelectTrigger size="xs" className="border-none bg-transparent shadow-none px-1.5 gap-1.5 text-xs font-medium hover:bg-accent/50 rounded-md">
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
      </div>
    );
  }

  if (projectId !== undefined && onProjectChange) {
    fields.push(
      <div key="project" className="flex items-center">
        <Select value={projectId} onValueChange={onProjectChange}>
          <SelectTrigger size="xs" className="border-none bg-transparent shadow-none px-1.5 gap-1.5 text-xs font-medium hover:bg-accent/50 rounded-md max-w-[160px]">
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
      </div>
    );
  }

  if (date !== undefined && onDateChange) {
    fields.push(
      <div key="date" className="flex items-center gap-1.5">
        <Calendar className="h-2.5 w-2.5 text-muted-foreground" />
        <Input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="h-7 w-[130px] border-none bg-transparent shadow-none px-1 text-xs font-medium"
          title={dateLabel}
        />
      </div>
    );
  }

  if (attendees !== undefined && onAttendeesChange) {
    fields.push(
      <div key="attendees" className="flex items-center gap-1.5 flex-1 min-w-[120px]">
        <span className="text-xs text-muted-foreground">Attendees:</span>
        <Input
          type="text"
          value={attendees}
          onChange={(e) => onAttendeesChange(e.target.value)}
          placeholder="John, Sarah..."
          className="h-7 flex-1 border-none bg-transparent shadow-none px-1 text-xs"
        />
      </div>
    );
  }

  if (fields.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-1 gap-y-1 py-1", className)}>
      {fields.map((field, i) => (
        <div key={i} className="flex items-center">
          {i > 0 && (
            <span className="text-muted-foreground/30 text-xs mx-1 select-none">·</span>
          )}
          {field}
        </div>
      ))}
    </div>
  );
}
