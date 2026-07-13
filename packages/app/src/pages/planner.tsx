/**
 * PlannerPage — the week planner.
 *
 * There is no view switch: the cross-workspace "Board" was removed. It duplicated the
 * Tasks page's kanban (which is editable and workspace-scoped) in read-only form, and
 * the week grid plus its task rail is what the planner is for.
 */

import { WeekView } from "@/components/planner/week-view";

export default function PlannerPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <WeekView />
    </div>
  );
}
