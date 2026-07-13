import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  /** Right-aligned slot (count, action link) — rendered without the uppercase treatment. */
  end?: React.ReactNode;
  /** Sticky variant for headers inside scrolling lists (e.g. month groups). */
  sticky?: boolean;
  className?: string;
}

/**
 * The one uppercase micro-header used for section labels across panes, pages,
 * and the sidebar. Surface-specific size/color adjustments go through className
 * (cn uses tailwind-merge, so overrides win).
 */
export function SectionLabel({ children, end, sticky, className }: SectionLabelProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70",
        sticky && "sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-3 py-1",
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {end && (
        <span className="ml-auto flex items-center gap-1 normal-case tracking-normal">{end}</span>
      )}
    </div>
  );
}
