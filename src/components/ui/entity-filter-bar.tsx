"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  allLabel?: string;
  width?: string;
}

interface EntityFilterBarProps {
  filters: FilterConfig[];
  count: number;
  countLabel: string;
  className?: string;
  /** Optional element to render on the right side (e.g., view toggle) */
  rightElement?: React.ReactNode;
}

/**
 * Reusable filter bar for entity lists (tasks, notes, meetings)
 * Provides a consistent UI for filtering across the app
 */
export function EntityFilterBar({
  filters,
  count,
  countLabel,
  className,
  rightElement,
}: EntityFilterBarProps) {
  return (
    <div className={cn("px-4 py-2 border-b flex items-center gap-3 flex-wrap", className)}>
      {filters.map((filter) => (
        <div key={filter.id} className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{filter.label}:</span>
          <Select value={filter.value} onValueChange={filter.onChange}>
            <SelectTrigger className={cn("h-7 text-xs", filter.width || "w-[160px]")}>
              <SelectValue placeholder={filter.allLabel || "All"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{filter.allLabel || "All"}</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {count} {countLabel}
        </span>
        {rightElement}
      </div>
    </div>
  );
}
