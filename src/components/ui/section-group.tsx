import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { appSurfaceClasses } from "@/lib/enterprise-ui";

interface SectionGroupProps {
  icon?: ReactNode;
  title: ReactNode;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
  variant?: "plain" | "inset";
  className?: string;
}

export function SectionGroup({
  icon,
  title,
  count,
  actions,
  children,
  variant = "plain",
  className,
}: SectionGroupProps) {
  return (
    <section
      className={cn(
        variant === "inset" ? appSurfaceClasses.sectionGroupInset : appSurfaceClasses.sectionGroup,
        variant === "inset" && "px-3 py-2",
        className
      )}
    >
      <div className="flex items-center gap-2 pb-2 mb-3 border-b border-border/60">
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
        <span className="font-medium text-sm flex-1 min-w-0">{title}</span>
        {count !== undefined && (
          <span className="text-[11px] tabular-nums font-medium text-muted-foreground/60 shrink-0">
            {count}
          </span>
        )}
        {actions && <span className="shrink-0">{actions}</span>}
      </div>
      {children}
    </section>
  );
}
