import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CaptureWidget,
  TriageDetailModal,
  type TriageDestination,
} from "@/components/dashboard";
import {
  useActiveTasks,
  useWorkspaceSummaries,
  useSettingsStore,
} from "@/stores";
import { useNavigate } from "react-router-dom";
import { Circle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";
import type { ActiveTask, WorkspaceSummary } from "@/lib/desk/dashboard";

// Default color for workspaces without a color
const DEFAULT_WORKSPACE_COLOR = "#64748b"; // slate-500

function FocusWidget({ tasks, isLoading }: { tasks: ActiveTask[]; isLoading: boolean }) {
  const navigate = useNavigate();
  const setCurrentWorkspaceId = useSettingsStore((state) => state.setCurrentWorkspaceId);

  const handleTaskClick = (task: ActiveTask) => {
    // Set the workspace context and navigate to tasks
    setCurrentWorkspaceId(task.workspaceId);
    navigate(`/tasks?open=${task.id}`);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-3 min-h-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <Loader2 className="size-4 text-orange-500" />
        <h2 className="text-base font-medium">Focus</h2>
        <span className="text-xs text-muted-foreground">
          {tasks.length} in progress
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin mr-2" />
          Loading...
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground text-sm">
          No tasks in progress
        </div>
      ) : (
        <div className="space-y-0.5">
          {tasks.map((task) => (
            <button
              key={`${task.workspaceId}-${task.id}`}
              onClick={() => handleTaskClick(task)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent/50 transition-colors text-left"
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
  const navigate = useNavigate();
  const setCurrentWorkspaceId = useSettingsStore(
    (state) => state.setCurrentWorkspaceId
  );

  const handleWorkspaceClick = (summary: WorkspaceSummary) => {
    // Set the workspace context and navigate to tasks
    setCurrentWorkspaceId(summary.workspaceId);
    navigate("/tasks");
  };

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="size-4 text-blue-500" />
        <h2 className="text-base font-medium">Workspaces</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin mr-2" />
          Loading...
        </div>
      ) : summaries.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground text-sm">
          No workspaces yet
        </div>
      ) : (
        <div className="space-y-1.5">
          {summaries.map((summary) => (
            <button
              key={summary.workspaceId}
              onClick={() => handleWorkspaceClick(summary)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm bg-muted/30 hover:bg-accent/50 transition-colors"
            >
              <Circle
                className="size-3 shrink-0"
                style={{ color: summary.color || DEFAULT_WORKSPACE_COLOR }}
                fill={summary.color || DEFAULT_WORKSPACE_COLOR}
              />
              <span className="flex-1 text-left truncate font-medium">{summary.name}</span>
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

  // Triage detail modal state
  const [triageModalOpen, setTriageModalOpen] = useState(false);
  const [triagedTask, setTriagedTask] = useState<Task | null>(null);
  const [triageDestination, setTriageDestination] = useState<TriageDestination | null>(null);

  const handleTriageComplete = (task: Task, destination: TriageDestination) => {
    setTriagedTask(task);
    setTriageDestination(destination);
    setTriageModalOpen(true);
  };

  const handleTriageModalClose = () => {
    setTriageModalOpen(false);
    setTriagedTask(null);
    setTriageDestination(null);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b border-border flex items-center px-4">
        <h1 className="text-base font-semibold">Dashboard</h1>
      </header>

      <ScrollArea className="flex-1">
        <main className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
            {/* Row 1: Capture + Focus */}
            <CaptureWidget onTriageComplete={handleTriageComplete} />
            <FocusWidget tasks={activeTasks} isLoading={tasksLoading} />

            {/* Row 2: Workspaces (spans full width on larger screens) */}
            <div className="lg:col-span-2">
              <WorkspacesWidget
                summaries={workspaceSummaries}
                isLoading={summariesLoading}
              />
            </div>
          </div>
        </main>
      </ScrollArea>

      <TriageDetailModal
        open={triageModalOpen}
        onClose={handleTriageModalClose}
        task={triagedTask}
        destination={triageDestination}
      />
    </div>
  );
}
