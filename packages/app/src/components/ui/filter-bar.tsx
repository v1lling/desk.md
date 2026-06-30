import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { densityClasses, type Density } from "@/lib/enterprise-ui";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterBarConfig {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  allLabel?: string;
  width?: string;
}

interface FilterBarProps {
  filters: FilterBarConfig[];
  count: number;
  countLabel: string;
  className?: string;
  rightElement?: React.ReactNode;
  density?: Density;
}

export function FilterBar({
  filters,
  count,
  countLabel,
  className,
  rightElement,
  density = "regular",
}: FilterBarProps) {
  const { t } = useTranslation();
  const rowHeight = densityClasses[density].section;
  const defaultAllLabel = t("common.buttons.all");

  return (
    <div className={cn("px-4 py-2 border-b border-border/80 flex items-center gap-3 flex-wrap", rowHeight, className)}>
      {filters.map((filter) => (
        <div key={filter.id} className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{filter.label}:</span>
          <Select value={filter.value} onValueChange={filter.onChange}>
            <SelectTrigger size="xs" className={cn("text-xs", filter.width || "w-[160px]")}>
              <SelectValue placeholder={filter.allLabel || defaultAllLabel} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{filter.allLabel || defaultAllLabel}</SelectItem>
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
