import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { appSurfaceClasses } from "@/lib/enterprise-ui";

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  icon,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section className={cn(className)}>
      <div className="flex items-start gap-2 mb-2 px-1">
        {icon && (
          <span className="shrink-0 text-muted-foreground/75 mt-0.5">{icon}</span>
        )}
        <div className="min-w-0">
          <p className={appSurfaceClasses.sectionLabel}>{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className={cn(appSurfaceClasses.sectionGroupInset, "px-4 py-2")}>
        {children}
      </div>
    </section>
  );
}
