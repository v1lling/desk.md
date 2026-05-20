import { useRef } from "react";
import { Calendar, X } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";

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
 * A date field that renders its own formatted text (so typography matches the
 * app font) while still using the native `<input type="date">` element and the
 * native OS date picker — no calendar library.
 */
export function DateField({
  value,
  onChange,
  variant = "input",
  placeholder = "Select date",
  id,
  clearable = true,
  disabled,
  className,
}: DateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const display = formatDisplay(value);
  const isChip = variant === "chip";

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  };

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
      <button
        type="button"
        id={id}
        onClick={openPicker}
        disabled={disabled}
        className={cn(
          "flex min-w-0 flex-1 items-center outline-none disabled:cursor-not-allowed",
          isChip
            ? "h-full gap-1.5 rounded-md px-1.5 text-xs font-medium focus-visible:bg-accent/50"
            : "gap-2 text-sm"
        )}
      >
        <Calendar
          className={cn(
            "shrink-0 text-muted-foreground",
            isChip ? "h-2.5 w-2.5" : "h-4 w-4"
          )}
        />
        <span className={cn("truncate", !display && "text-muted-foreground")}>
          {display ?? placeholder}
        </span>
      </button>

      {clearable && display && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear date"
          className={cn(
            "flex shrink-0 items-center justify-center rounded text-muted-foreground/50 outline-none hover:text-foreground focus-visible:text-foreground",
            isChip ? "h-7 px-1" : "h-full px-1"
          )}
        >
          <X className={isChip ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </button>
      )}

      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
    </div>
  );
}
