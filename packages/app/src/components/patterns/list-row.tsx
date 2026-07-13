import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ListRowProps {
  /** Leading icon or status dot. Caller styles it (size, color, mt when a second line shows). */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** Right-aligned muted meta on the title line (date, count). */
  meta?: React.ReactNode;
  /** Optional second line under the title (e.g. project name). Switches the row to top alignment. */
  secondLine?: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  /** DropdownMenuItem children for the hover-visible overflow menu. */
  menuItems?: React.ReactNode;
  className?: string;
}

/**
 * The shared row grammar for pane and section lists: leading slot, title with
 * right-aligned meta, optional second line, selection highlight, and a
 * hover-visible overflow menu.
 */
export function ListRow({
  leading,
  title,
  meta,
  secondLine,
  isActive,
  onClick,
  menuItems,
  className,
}: ListRowProps) {
  const alignTop = secondLine != null;
  return (
    <div
      className={cn(
        "group flex gap-2 px-3 py-1.5 cursor-pointer rounded-sm mx-1 hover:bg-accent/40",
        alignTop ? "items-start" : "items-center",
        isActive && "bg-accent",
        className,
      )}
      onClick={onClick}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate flex-1">{title}</span>
          {meta != null && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70 tabular-nums shrink-0">
              {meta}
            </span>
          )}
        </div>
        {secondLine != null && (
          <div className="text-[11px] text-muted-foreground/70 truncate">{secondLine}</div>
        )}
      </div>
      {menuItems != null && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground",
                alignTop && "mt-0.5",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">{menuItems}</DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
