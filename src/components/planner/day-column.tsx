/**
 * DayColumn — A single day in the week view with workspace blocks
 */

import { parseISO, isToday } from "date-fns";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDayName, formatDayNumber } from "@/lib/desk/planner";
import { WorkspaceBlockCard } from "./workspace-block";
import { AddBlockButton } from "./add-block-popover";
import type { WorkspaceBlock, Workspace } from "@/types";
import type { ActiveTask } from "@/lib/desk/dashboard";

interface DayColumnProps {
  date: string;
  weekOf: string;
  blocks: WorkspaceBlock[];
  allTasks: ActiveTask[];
  workspaces: Workspace[];
}

export function DayColumn({
  date,
  weekOf,
  blocks,
  allTasks,
  workspaces,
}: DayColumnProps) {
  const today = isToday(parseISO(date));

  const { setNodeRef, isOver } = useDroppable({
    id: `day:${date}`,
    data: { type: "day", date },
  });

  return (
    <div
      className={cn(
        "flex flex-col border-r border-border/40 last:border-r-0 min-w-0",
        isOver && "bg-accent/30"
      )}
    >
      {/* Day header */}
      <div
        className={cn(
          "shrink-0 px-3 py-2 text-center border-b border-border/40",
          today && "bg-primary/5"
        )}
      >
        <div
          className={cn(
            "text-[11px] uppercase tracking-wide",
            today ? "text-primary font-semibold" : "text-muted-foreground"
          )}
        >
          {formatDayName(date)}
        </div>
        <div
          className={cn(
            "text-sm font-medium",
            today ? "text-primary" : "text-foreground/80"
          )}
        >
          {formatDayNumber(date)}
        </div>
      </div>

      {/* Blocks area */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={setNodeRef} className="p-2 space-y-2 min-h-[120px]">
          <SortableContext
            items={blocks.map((b) => `block:${b.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {blocks.map((block) => (
              <WorkspaceBlockCard
                key={block.id}
                block={block}
                day={date}
                weekOf={weekOf}
                allTasks={allTasks}
                workspaces={workspaces}
              />
            ))}
          </SortableContext>
          <AddBlockButton date={date} weekOf={weekOf} />
        </div>
      </ScrollArea>
    </div>
  );
}
