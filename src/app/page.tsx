"use client";

import { Header } from "@/components/layout";
import {
  useActiveTasks,
  useWorkspaceSummaries,
  useSettingsStore,
} from "@/stores";
import { useRouter } from "next/navigation";
import { Circle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveTask, WorkspaceSummary } from "@/lib/orbit/dashboard";

// Default color for workspaces without a color
const DEFAULT_WORKSPACE_COLOR = "#64748b"; // slate-500

function FocusWidget({ tasks, isLoading }: { tasks: ActiveTask[]; isLoading: boolean }) {
  const router = useRouter();

  const handleTaskClick = (task: ActiveTask) => {
    if (task.workspaceId === "__personal__") {
      router.push("/personal/tasks");
    } else {
      router.push(`/tasks?open=${task.id}`);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="size-4 text-orange-500" />
        <h2 className="font-medium">Focus</h2>
        <span className="text-xs text-muted-foreground">
          {tasks.length} in progress
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="size-4 animate-spin mr-2" />
          Loading...
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm">
          No tasks in progress
        </div>
      ) : (
        <div className="space-y-1">
          {tasks.map((task) => (
            <button
              key={`${task.workspaceId}-${task.id}`}
              onClick={() => handleTaskClick(task)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent/50 transition-colors text-left"
            >
              <Circle
                className="size-2 shrink-0"
                style={{ color: task.workspaceColor || DEFAULT_WORKSPACE_COLOR }}
                fill={task.workspaceColor || DEFAULT_WORKSPACE_COLOR}
              />
              <span className="flex-1 truncate">{task.title}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {task.workspaceName}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkspacesWidget({
  summaries,
  isLoading,
}: {
  summaries: WorkspaceSummary[];
  isLoading: boolean;
}) {
  const router = useRouter();
  const setCurrentWorkspaceId = useSettingsStore(
    (state) => state.setCurrentWorkspaceId
  );

  const handleWorkspaceClick = (summary: WorkspaceSummary) => {
    if (summary.workspaceId === "__personal__") {
      router.push("/personal/tasks");
    } else {
      setCurrentWorkspaceId(summary.workspaceId);
      router.push("/tasks");
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="size-4 text-blue-500" />
        <h2 className="font-medium">Workspaces</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="size-4 animate-spin mr-2" />
          Loading...
        </div>
      ) : summaries.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm">
          No workspaces yet
        </div>
      ) : (
        <div className="space-y-2">
          {summaries.map((summary) => (
            <button
              key={summary.workspaceId}
              onClick={() => handleWorkspaceClick(summary)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent/50 transition-colors"
            >
              <Circle
                className="size-3 shrink-0"
                style={{ color: summary.color || DEFAULT_WORKSPACE_COLOR }}
                fill={summary.color || DEFAULT_WORKSPACE_COLOR}
              />
              <span className="flex-1 text-left truncate">{summary.name}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {summary.completedTasks}/{summary.totalTasks}
              </span>
              <ProgressBar percent={summary.completionPercent} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          percent === 100
            ? "bg-green-500"
            : percent >= 50
              ? "bg-blue-500"
              : "bg-orange-500"
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export default function DashboardPage() {
  const { data: activeTasks = [], isLoading: tasksLoading } = useActiveTasks();
  const { data: workspaceSummaries = [], isLoading: summariesLoading } =
    useWorkspaceSummaries();

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" />

      <main className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
          <FocusWidget tasks={activeTasks} isLoading={tasksLoading} />
          <WorkspacesWidget
            summaries={workspaceSummaries}
            isLoading={summariesLoading}
          />
        </div>
      </main>
    </div>
  );
}
