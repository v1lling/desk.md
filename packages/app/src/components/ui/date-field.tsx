import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { formatLocalISODate } from "@desk/core";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateFieldProps {
  /** ISO date string ("yyyy-mm-dd") or "" when unset. */
  value: string;
  onChange: (value: string) => void;
  /** "input" = bordered field for modals; "chip" = borderless chip for the metadata row. */
  variant?: "input" | "chip";
  /** Label shown when no date is set. */
  placeholder?: string;
  id?: string;
  /** Show a clear button when a date is set. */
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
}

function formatDisplay(value: string): string | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, "MMM d, yyyy") : value;
}

/**
 * A date field opening an in-app calendar in a Popover.
 *
 * Deliberately NOT the native `<input type="date">` + showPicker(): WKWebView anchors
 * that popover to the (hidden) input and its dismissal logic never fires — the OS
 * calendar stayed open across date picks and page switches, and there is no close API.
 * The Popover is DOM we own: pick → closes, click outside → closes, unmount → gone.
 */
export function DateField({
  value,
  onChange,
  variant = "input",
  placeholder,
  id,
  clearable = true,
  disabled,
  className,
}: DateFieldProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const display = formatDisplay(value);
  const isChip = variant === "chip";
  const resolvedPlaceholder = placeholder ?? t("ui.dateField.placeholder");

  const parsed = value ? parseISO(value) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div
      className={cn(
        "inline-flex items-center transition-[color,box-shadow]",
        isChip
          ? "h-7 rounded-md hover:bg-accent/50"
          : "h-9 w-full rounded-md border border-input bg-transparent px-3 shadow-xs focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] dark:bg-input/30",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            className={cn(
              "flex min-w-0 flex-1 items-center outline-none disabled:cursor-not-allowed",
              isChip
                ? "h-full gap-1.5 rounded-md px-1.5 text-xs font-medium focus-visible:bg-accent/50"
                : "gap-2 text-sm"
            )}
          >
            <CalendarIcon
              className={cn(
                "shrink-0 text-muted-foreground",
                isChip ? "h-2.5 w-2.5" : "h-4 w-4"
              )}
            />
            <span className={cn("truncate", !display && "text-muted-foreground")}>
              {display ?? resolvedPlaceholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              // Local calendar day, never toISOString (UTC — off by one near midnight).
              onChange(date ? formatLocalISODate(date) : "");
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {clearable && display && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          aria-label={t("ui.dateField.clearAriaLabel")}
          className={cn(
            "flex shrink-0 items-center justify-center rounded text-muted-foreground/50 outline-none hover:text-foreground focus-visible:text-foreground",
            isChip ? "h-7 px-1" : "h-full px-1"
          )}
        >
          <X className={isChip ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </button>
      )}
    </div>
  );
}
