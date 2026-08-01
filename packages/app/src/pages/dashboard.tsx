import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Circle,
  Star,
} from "lucide-react";
import {
  getScopedEntityKey,
  minutesToTime,
  SPECIAL_DIRS,
  type DashboardTaskItem,
  type RecentWorkItem,
  type WorkspaceBlock,
} from "@desk/core";
import type { Task } from "@desk/core/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { DataCard } from "@/components/ui/data-card";
import { DataRow } from "@/components/ui/data-row";
import { DenseList } from "@/components/ui/dense-list";
import { DueLabel } from "@/components/ui/due-label";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { SectionLabel } from "@/components/patterns";
import { RecentWorkList, type RecentWorkListItem } from "@/components/recent-work-list";
import {
  CaptureWidget,
  TriageDetailModal,
  type TriageDestination,
} from "@/components/dashboard";
import {
  useClearFocusTask,
  useDashboardOverview,
  useOpenTab,
  useWorkspaces,
} from "@/stores";
import { usePlannerHydrated, usePlannerStore } from "@/stores/planner";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { selectCurrentAndUpcomingBlocks } from "@/lib/dashboard-today";
import { cn } from "@/lib/utils";

const DEFAULT_WORKSPACE_COLOR = "#64748b";
const FOCUS_COLLAPSED_LIMIT = 6;
const TODAY_BLOCK_LIMIT = 3;
const TODAY_DUE_LIMIT = 4;
const NO_BLOCKS: WorkspaceBlock[] = [];

function FocusWidget({
  tasks,
  isLoading,
}: {
  tasks: DashboardTaskItem[];
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openTask } = useOpenTab();
  const clearFocus = useClearFocusTask();
  const [showAll, setShowAll] = useState(false);

  const visibleTasks = showAll ? tasks : tasks.slice(0, FOCUS_COLLAPSED_LIMIT);
  const hiddenCount = tasks.length - FOCUS_COLLAPSED_LIMIT;

  return (
    <DataCard className="min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <Star className="size-4 fill-brand-accent/20 text-brand-accent" />
        <h2 className="text-base font-medium">{t("pages.dashboard.focus.title")}</h2>
      </div>

      {isLoading ? (
        <LoadingSkeleton variant="list" rows={4} className="py-2" />
      ) : tasks.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm font-medium">{t("pages.dashboard.focus.emptyTitle")}</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            {t("pages.dashboard.focus.emptyDescription")}
          </p>
          <Button
            variant="link"
            size="sm"
            className="mt-1 h-7 px-1 text-xs"
            onClick={() => navigate("/tasks")}
          >
            {t("pages.dashboard.focus.openTasks")}
          </Button>
        </div>
      ) : (
        <>
          <DenseList>
            {visibleTasks.map((task) => (
              <DataRow key={getScopedEntityKey(task)} className="group/row">
                <button
                  type="button"
                  onClick={() => openTask(task)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <Circle
                    className="size-2 shrink-0"
                    style={{ color: task.workspaceColor || DEFAULT_WORKSPACE_COLOR }}
                    fill={task.workspaceColor || DEFAULT_WORKSPACE_COLOR}
                  />
                  <span className="flex-1 truncate text-sm">{task.title}</span>
                  <DueLabel due={task.due} status={task.status} />
                  <span className="max-w-28 shrink-0 truncate text-xs text-muted-foreground">
                    {task.workspaceName}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground opacity-40 hover:text-brand-accent group-hover/row:opacity-100 focus-visible:opacity-100"
                  onClick={() => clearFocus.mutate(task)}
                  disabled={clearFocus.isPending}
                  aria-label={t("pages.dashboard.focus.remove", { title: task.title })}
                  title={t("pages.dashboard.focus.remove", { title: task.title })}
                >
                  <Star className="size-3.5 fill-current" />
                </Button>
              </DataRow>
            ))}
          </DenseList>

          {hiddenCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {showAll
                ? t("pages.dashboard.focus.showLess")
                : t("pages.dashboard.focus.showMore", { count: hiddenCount })}
            </Button>
          )}
        </>
      )}
    </DataCard>
  );
}

function TodayWidget({
  blocks,
  dueTasks,
  minute,
  isLoading,
}: {
  blocks: WorkspaceBlock[];
  dueTasks: DashboardTaskItem[];
  minute: number;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openTask } = useOpenTab();
  const { data: workspaces = [] } = useWorkspaces();
  const workspaceById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces],
  );
  const upcomingBlocks = useMemo(
    () => selectCurrentAndUpcomingBlocks(blocks, minute, TODAY_BLOCK_LIMIT),
    [blocks, minute],
  );
  const shownDueTasks = dueTasks.slice(0, TODAY_DUE_LIMIT);
  const dueOverflow = dueTasks.length - shownDueTasks.length;
  const isEmpty = upcomingBlocks.length === 0 && dueTasks.length === 0;

  return (
    <DataCard className="min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <CalendarDays className="size-4 text-primary" />
        <h2 className="flex-1 text-base font-medium">{t("pages.dashboard.today.title")}</h2>
        <Button
          variant="link"
          size="sm"
          className="h-7 px-1 text-xs text-muted-foreground"
          onClick={() => navigate("/planner")}
        >
          {t("pages.dashboard.today.openPlanner")}
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton variant="list" rows={4} className="py-2" />
      ) : isEmpty ? (
        <div className="py-6 text-center">
          <p className="text-sm font-medium">{t("pages.dashboard.today.emptyTitle")}</p>
          <Button
            variant="link"
            size="sm"
            className="mt-1 h-7 px-1 text-xs"
            onClick={() => navigate("/planner")}
          >
            {t("pages.dashboard.today.planDay")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {upcomingBlocks.length > 0 && (
            <DenseList>
              {upcomingBlocks.map((block) => {
                const workspace = workspaceById.get(block.workspaceId);
                const current = block.startMinute <= minute && minute < block.endMinute;
                return (
                  <button
                    type="button"
                    key={block.id}
                    onClick={() => navigate("/planner")}
                    className="w-full text-left"
                  >
                    <DataRow className={cn(current && "bg-primary/[0.06]")}>
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: workspace?.color || DEFAULT_WORKSPACE_COLOR }}
                      />
                      <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {minutesToTime(block.startMinute)}–{minutesToTime(block.endMinute)}
                      </span>
                      <span className="flex-1 truncate text-sm">{workspace?.name ?? block.workspaceId}</span>
                      {block.taskIds.length > 0 && (
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {t("pages.dashboard.today.taskCount", { count: block.taskIds.length })}
                        </span>
                      )}
                    </DataRow>
                  </button>
                );
              })}
            </DenseList>
          )}

          {shownDueTasks.length > 0 && (
            <div>
              <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {t("pages.dashboard.today.dueHeading")}
              </p>
              <DenseList>
                {shownDueTasks.map((task) => (
                  <button
                    type="button"
                    key={getScopedEntityKey(task)}
                    onClick={() => openTask(task)}
                    className="w-full text-left"
                  >
                    <DataRow>
                      <Circle
                        className="size-2 shrink-0"
                        style={{ color: task.workspaceColor || DEFAULT_WORKSPACE_COLOR }}
                        fill={task.workspaceColor || DEFAULT_WORKSPACE_COLOR}
                      />
                      <span className="flex-1 truncate text-sm">{task.title}</span>
                      <DueLabel due={task.due} status={task.status} />
                    </DataRow>
                  </button>
                ))}
              </DenseList>
              {dueOverflow > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => navigate("/planner")}
                >
                  {t("pages.dashboard.today.moreDue", { count: dueOverflow })}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </DataCard>
  );
}

function recentLocation(item: RecentWorkItem, unassignedLabel: string): string {
  const projectName = item.projectName
    ?? (item.projectId === SPECIAL_DIRS.UNASSIGNED ? unassignedLabel : undefined);
  return projectName ? `${item.workspaceName} · ${projectName}` : item.workspaceName;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { today, minute } = useMinuteClock();
  const plannerHydrated = usePlannerHydrated();
  const todayBlocks = usePlannerStore(
    (state) => state.weekPlans[today]?.days[today] ?? NO_BLOCKS,
  );
  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
    refetch: refetchOverview,
  } = useDashboardOverview(today);
  const { openTask, openDoc, openMeeting } = useOpenTab();

  const [triageModalOpen, setTriageModalOpen] = useState(false);
  const [triagedTask, setTriagedTask] = useState<Task | null>(null);
  const [triageDestination, setTriageDestination] = useState<TriageDestination | null>(null);

  const recentItems = useMemo<RecentWorkListItem[]>(
    () => (overview?.recentWork ?? []).map((item) => ({
      kind: item.kind,
      id: `${item.workspaceId}:${item.projectId}:${item.id}`,
      title: item.title,
      activityAt: item.activityAt,
      location: recentLocation(item, t("pages.dashboard.recent.unassigned")),
      onOpen: () => {
        if (item.kind === "task") openTask(item);
        else if (item.kind === "doc") openDoc(item);
        else openMeeting(item);
      },
    })),
    [overview?.recentWork, openTask, openDoc, openMeeting, t],
  );

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
    <div className="flex h-full flex-col overflow-hidden">
      <ScrollArea className="flex-1">
        <main className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
          <CaptureWidget onTriageComplete={handleTriageComplete} />

          {overviewError ? (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.03] px-4 py-3">
              <AlertCircle className="size-4 shrink-0 text-destructive/80" />
              <p className="flex-1 text-sm text-muted-foreground">
                {t("pages.dashboard.overviewError")}
              </p>
              <Button variant="outline" size="sm" onClick={() => void refetchOverview()}>
                {t("common.buttons.retry")}
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
                <FocusWidget
                  tasks={overview?.focusTasks ?? []}
                  isLoading={overviewLoading}
                />
                <TodayWidget
                  blocks={todayBlocks}
                  dueTasks={overview?.dueTasks ?? []}
                  minute={minute}
                  isLoading={overviewLoading || !plannerHydrated}
                />
              </div>

              {overviewLoading ? (
                <section className="pt-1">
                  <SectionLabel className="mb-1">{t("pages.dashboard.recent.title")}</SectionLabel>
                  <LoadingSkeleton variant="list" rows={4} />
                </section>
              ) : recentItems.length > 0 ? (
                <section className="pt-1">
                  <SectionLabel className="mb-1">{t("pages.dashboard.recent.title")}</SectionLabel>
                  <RecentWorkList items={recentItems} />
                </section>
              ) : null}
            </>
          )}
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
