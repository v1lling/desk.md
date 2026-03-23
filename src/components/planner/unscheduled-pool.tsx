/**
 * TasksPool — Right panel showing all plannable tasks grouped by workspace
 */

import { useMemo } from "react";
import { Circle, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useOpenTab } from "@/stores/tabs";
import { MiniTaskItem } from "./mini-task-item";
import type { Workspace } from "@/types";
import type { ActiveTask } from "@/lib/desk/dashboard";

interface TasksPoolProps {
  tasks: ActiveTask[];
  workspaces: Workspace[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  weekOf: string;
}

export function TasksPool({
  tasks,
  workspaces,
  collapsed,
  onToggleCollapse,
  weekOf,
}: TasksPoolProps) {
  const { openTask } = useOpenTab();

  // Group tasks by workspace
  const grouped = useMemo(() => {
    const map = new Map<string, ActiveTask[]>();
    for (const task of tasks) {
      const existing = map.get(task.workspaceId) || [];
      existing.push(task);
      map.set(task.workspaceId, existing);
    }
    return map;
  }, [tasks]);

  const handleTaskClick = (task: ActiveTask) => {
    openTask({
      id: task.id,
      title: task.title,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
    });
  };

  if (collapsed) {
    return (
      <div className="shrink-0 w-10 border-l border-border/40 flex flex-col items-center pt-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onToggleCollapse}
          title="Show tasks"
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
        {tasks.length > 0 && (
          <span className="text-[10px] text-muted-foreground mt-1 tabular-nums">
            {tasks.length}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="shrink-0 w-64 border-l border-border/40 flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b border-border/40 flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex-1">
          Tasks
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {tasks.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onToggleCollapse}
          title="Hide panel"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Task list grouped by workspace */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-3">
          {workspaces.map((ws) => {
            const wsTasks = grouped.get(ws.id);
            if (!wsTasks || wsTasks.length === 0) return null;

            return (
              <div key={ws.id}>
                <div className="flex items-center gap-1.5 px-1.5 mb-1">
                  <Circle
                    className="h-2 w-2 shrink-0"
                    style={{
                      color: ws.color || "#64748b",
                      fill: ws.color || "#64748b",
                    }}
                  />
                  <span className="text-[11px] font-medium text-muted-foreground truncate">
                    {ws.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 ml-auto tabular-nums">
                    {wsTasks.length}
                  </span>
                </div>
                <div>
                  {wsTasks.map((task) => (
                    <MiniTaskItem
                      key={task.id}
                      task={task}
                      onClick={() => handleTaskClick(task)}
                      draggableId={`pool-task:${task.id}`}
                      monochrome
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && (
            <p className="text-[11px] text-muted-foreground/50 text-center py-4">
              No active tasks
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
