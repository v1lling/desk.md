import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CaptureWidget,
  TriageDetailModal,
  type TriageDestination,
} from "@/components/dashboard";
import {
  useFocusTasks,
  useWorkspaceSummaries,
  useNavigationStore,
} from "@/stores";
import { useNavigate } from "react-router-dom";
import { Circle, CheckCircle2, Star } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import type { Task } from "@desk/core/types";
import type { ActiveTask, WorkspaceSummary } from "@desk/core";
import { DataCard } from "@/components/ui/data-card";
import { DataRow } from "@/components/ui/data-row";
import { DenseList } from "@/components/ui/dense-list";

const DEFAULT_WORKSPACE_COLOR = "#64748b";

function FocusWidget({ tasks, isLoading }: { tasks: ActiveTask[]; isLoading: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setCurrentWorkspaceId = useNavigationStore((state) => state.setCurrentWorkspaceId);

  const handleTaskClick = (task: ActiveTask) => {
    setCurrentWorkspaceId(task.workspaceId);
    navigate(`/tasks?open=${task.id}`);
  };

  return (
    <DataCard>
      <div className="flex items-center gap-2 mb-2">
        <Star className="size-4 text-brand-accent" />
        <h2 className="text-base font-medium">{t("pages.dashboard.focus.title")}</h2>
        <span className="text-xs text-muted-foreground">{t("pages.dashboard.focus.highlightedCount", { count: tasks.length })}</span>
      </div>

      {isLoading ? (
        <LoadingState label={t("pages.dashboard.focus.loadingLabel")} display="inline" className="py-8" />
      ) : tasks.length === 0 ? (
        <EmptyState
          title={t("pages.dashboard.focus.emptyTitle")}
          description={t("pages.dashboard.focus.emptyDescription")}
          display="inline"
          className="py-8"
        />
      ) : (
        <DenseList>
          {tasks.map((task) => (
            <button key={`${task.workspaceId}-${task.id}`} onClick={() => handleTaskClick(task)} className="w-full text-left">
              <DataRow density="regular">
                <Circle
                  className="size-2 shrink-0"
                  style={{ color: task.workspaceColor || DEFAULT_WORKSPACE_COLOR }}
                  fill={task.workspaceColor || DEFAULT_WORKSPACE_COLOR}
                />
                <span className="flex-1 truncate text-sm">{task.title}</span>
                <span className="text-xs text-muted-foreground shrink-0">{task.workspaceName}</span>
              </DataRow>
            </button>
          ))}
        </DenseList>
      )}
    </DataCard>
  );
}

function WorkspacesWidget({
  summaries,
  isLoading,
}: {
  summaries: WorkspaceSummary[];
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setCurrentWorkspaceId = useNavigationStore(
    (state) => state.setCurrentWorkspaceId
  );

  const handleWorkspaceClick = (summary: WorkspaceSummary) => {
    setCurrentWorkspaceId(summary.workspaceId);
    navigate("/tasks");
  };

  return (
    <DataCard>
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="size-4 text-primary" />
        <h2 className="text-base font-medium">{t("pages.dashboard.workspaces.title")}</h2>
      </div>

      {isLoading ? (
        <LoadingState label={t("pages.dashboard.workspaces.loadingLabel")} display="inline" className="py-8" />
      ) : summaries.length === 0 ? (
        <EmptyState title={t("pages.dashboard.workspaces.emptyTitle")} display="inline" className="py-8" />
      ) : (
        <DenseList className="space-y-1.5">
          {summaries.map((summary) => (
            <button
              key={summary.workspaceId}
              onClick={() => handleWorkspaceClick(summary)}
              className="w-full"
            >
              <DataRow className="bg-muted/35">
                <Circle
                  className="size-3 shrink-0"
                  style={{ color: summary.color || DEFAULT_WORKSPACE_COLOR }}
                  fill={summary.color || DEFAULT_WORKSPACE_COLOR}
                />
                <span className="flex-1 text-left truncate font-medium text-sm">{summary.name}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                  {t("pages.dashboard.workspaces.activeCount", { count: summary.activeTasks })}
                </span>
              </DataRow>
            </button>
          ))}
        </DenseList>
      )}
    </DataCard>
  );
}

export default function DashboardPage() {
  const { data: focusTasks = [], isLoading: tasksLoading } = useFocusTasks();
  const { data: workspaceSummaries = [], isLoading: summariesLoading } =
    useWorkspaceSummaries();

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
    <div className="flex flex-col h-full overflow-hidden">
      <ScrollArea className="flex-1">
        <main className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
            <CaptureWidget onTriageComplete={handleTriageComplete} />
            <FocusWidget tasks={focusTasks} isLoading={tasksLoading} />

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
