import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { appSurfaceClasses } from "@/lib/enterprise-ui";

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  /** Use "inset" for contained/advanced zones that benefit from a subtle background. */
  variant?: "plain" | "inset";
  className?: string;
}

export function SettingsSection({
  title,
  description,
  icon,
  children,
  variant = "plain",
  className,
}: SettingsSectionProps) {
  return (
    <section
      className={cn(
        variant === "inset" && [appSurfaceClasses.sectionGroupInset, "px-3 py-3"],
        className
      )}
    >
      <div className={cn(
        "flex items-start gap-2",
        variant === "plain" ? "pb-3 mb-3 border-b border-border/60" : "pb-1 mb-2"
      )}>
        {icon && (
          <span className="shrink-0 text-muted-foreground mt-0.5">{icon}</span>
        )}
        <div className="min-w-0">
          <p className={appSurfaceClasses.sectionLabel}>{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
