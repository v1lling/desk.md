/**
 * PlannerPage — Planner with Week and All Tasks views
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { useWorkspaces } from "@/stores/workspaces";
import { PlannerBoard } from "@/components/planner/planner-board";
import { WeekView } from "@/components/planner/week-view";
import { cn } from "@/lib/utils";
import type { TaskViewMode } from "@desk/core/types";

type PlannerView = "board" | "week";

export default function PlannerPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<PlannerView>("week");
  const [boardViewMode, setBoardViewMode] = useState<TaskViewMode>("kanban");
  const [filterWorkspace, setFilterWorkspace] = useState("all");
  const { data: workspaces = [] } = useWorkspaces();

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border/60 h-11 px-4 flex items-center gap-3">
        {/* Week / All Tasks toggle */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/50 border border-border/40">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2.5 rounded-md transition-colors text-xs gap-1.5",
              view === "week"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-transparent"
            )}
            onClick={() => setView("week")}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {t("pages.planner.week")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2.5 rounded-md transition-colors text-xs gap-1.5",
              view === "board"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-transparent"
            )}
            onClick={() => setView("board")}
          >
            <ListChecks className="h-3.5 w-3.5" />
            {t("pages.planner.allTasks")}
          </Button>
        </div>

        <div className="flex-1" />

        {/* Board-specific controls */}
        {view === "board" && (
          <>
            <Select value={filterWorkspace} onValueChange={setFilterWorkspace}>
              <SelectTrigger className="h-7 w-[160px] text-xs">
                <SelectValue placeholder={t("pages.planner.allWorkspaces")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("pages.planner.allWorkspaces")}</SelectItem>
                {workspaces.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: ws.color || "#64748b" }}
                      />
                      {ws.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ViewModeToggle value={boardViewMode} onChange={setBoardViewMode} />
          </>
        )}
      </header>

      {/* Content */}
      {view === "board" ? (
        <PlannerBoard viewMode={boardViewMode} filterWorkspace={filterWorkspace} />
      ) : (
        <WeekView />
      )}
    </div>
  );
}
