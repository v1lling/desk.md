"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
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
}: EntityFilterBarProps) {
  return (
    <div className={cn("px-6 py-3 border-b flex items-center gap-4 flex-wrap", className)}>
      {filters.map((filter) => (
        <div key={filter.id} className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{filter.label}:</span>
          <Select value={filter.value} onValueChange={filter.onChange}>
            <SelectTrigger className={cn("h-8", filter.width || "w-[180px]")}>
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
      <Badge variant="secondary" className="ml-auto">
        {count} {countLabel}
      </Badge>
    </div>
  );
}
