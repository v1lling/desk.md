
import { Circle, Flag, FolderKanban, Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TaskStatus, TaskPriority } from "@/types";
import { priorityTextColors } from "@/lib/design-tokens";

// Status configuration
const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: "To Do", color: "text-muted-foreground" },
  doing: { label: "In Progress", color: "text-blue-600 dark:text-blue-400" },
  waiting: { label: "Waiting", color: "text-amber-600 dark:text-amber-400" },
  done: { label: "Done", color: "text-green-600 dark:text-green-400" },
};

const statusOptions: TaskStatus[] = ["todo", "doing", "waiting", "done"];

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

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 py-2 px-3 bg-muted/30 rounded-lg border border-border/40",
        className
      )}
    >
      {/* Status */}
      {status !== undefined && onStatusChange && (
        <div className="flex items-center">
          <Select value={status} onValueChange={(v) => onStatusChange(v as TaskStatus)}>
            <SelectTrigger className="h-7 border-none bg-transparent shadow-none px-2 gap-1.5 text-xs font-medium hover:bg-muted/50">
              <span className="flex items-center gap-1.5">
                <Circle className={cn("h-3 w-3 fill-current", statusConfig[status].color)} />
                <span>{statusConfig[status].label}</span>
              </span>
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-2">
                    <Circle className={cn("h-3 w-3 fill-current", statusConfig[s].color)} />
                    {statusConfig[s].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Divider */}
      {status !== undefined && priority !== undefined && (
        <div className="h-4 w-px bg-border/60" />
      )}

      {/* Priority */}
      {priority !== undefined && onPriorityChange && (
        <div className="flex items-center">
          <Select
            value={priority}
            onValueChange={(v) => onPriorityChange(v as TaskPriority | "none")}
          >
            <SelectTrigger className="h-7 border-none bg-transparent shadow-none px-2 gap-1.5 text-xs font-medium hover:bg-muted/50">
              <span className={cn(
                "flex items-center gap-1.5",
                priority !== "none" ? priorityConfig[priority as TaskPriority].color : "text-muted-foreground"
              )}>
                <Flag className="h-3 w-3" />
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
      )}

      {/* Divider */}
      {(status !== undefined || priority !== undefined) && projectId !== undefined && (
        <div className="h-4 w-px bg-border/60" />
      )}

      {/* Project */}
      {projectId !== undefined && onProjectChange && (
        <div className="flex items-center">
          <Select value={projectId} onValueChange={onProjectChange}>
            <SelectTrigger className="h-7 border-none bg-transparent shadow-none px-2 gap-1.5 text-xs font-medium hover:bg-muted/50 max-w-[150px]">
              <FolderKanban className="h-3 w-3 text-muted-foreground shrink-0" />
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
      )}

      {/* Divider */}
      {projectId !== undefined && date !== undefined && (
        <div className="h-4 w-px bg-border/60" />
      )}

      {/* Date */}
      {date !== undefined && onDateChange && (
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <Input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="h-7 w-[130px] border-none bg-transparent shadow-none px-1 text-xs font-medium"
            title={dateLabel}
          />
        </div>
      )}

      {/* Divider */}
      {date !== undefined && attendees !== undefined && (
        <div className="h-4 w-px bg-border/60" />
      )}

      {/* Attendees (for meetings) */}
      {attendees !== undefined && onAttendeesChange && (
        <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
          <span className="text-xs text-muted-foreground">Attendees:</span>
          <Input
            type="text"
            value={attendees}
            onChange={(e) => onAttendeesChange(e.target.value)}
            placeholder="John, Sarah..."
            className="h-7 flex-1 border-none bg-transparent shadow-none px-1 text-xs"
          />
        </div>
      )}
    </div>
  );
}
