/**
 * WeekNavigator — ← This Week → navigation controls
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, subDays, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { getWeekMonday, formatWeekRange } from "@desk/core";

interface WeekNavigatorProps {
  currentMonday: string;
  showWeekends: boolean;
  onChange: (monday: string) => void;
}

export function WeekNavigator({
  currentMonday,
  showWeekends,
  onChange,
}: WeekNavigatorProps) {
  const goBack = () => {
    const prev = subDays(parseISO(currentMonday), 7);
    onChange(getWeekMonday(prev));
  };

  const goForward = () => {
    const next = addDays(parseISO(currentMonday), 7);
    onChange(getWeekMonday(next));
  };

  const goToday = () => {
    onChange(getWeekMonday(new Date()));
  };

  const label = formatWeekRange(currentMonday, showWeekends);
  const isCurrentWeek = currentMonday === getWeekMonday(new Date());

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={goBack}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <button
        onClick={goToday}
        className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${
          isCurrentWeek
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        }`}
      >
        {label}
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={goForward}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
