import { Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { densityClasses, type Density, workspaceUiDefaults } from "@/lib/enterprise-ui";
import type { Workspace } from "@desk/core/types";

interface WorkspaceContextBadgeProps {
  workspace: Workspace;
  className?: string;
}

export function WorkspaceContextBadge({ workspace, className }: WorkspaceContextBadgeProps) {
  const color = workspace.color || workspaceUiDefaults.color;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <Circle className="size-3 shrink-0" style={{ color }} fill={color} />
      <Badge variant="outline" className="text-xs font-normal">
        {workspace.name}
      </Badge>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  workspace?: Workspace | null;
  subtitle?: string;
  actions?: React.ReactNode;
  density?: Density;
  className?: string;
}

export function PageHeader({
  title,
  workspace,
  subtitle,
  actions,
  density = "regular",
  className,
}: PageHeaderProps) {
  const headerHeight = densityClasses[density].header;

  return (
    <header className={cn("shrink-0 border-b border-border/80 px-4", headerHeight, className)}>
      <div className="h-full flex items-center gap-3">
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        {workspace && <WorkspaceContextBadge workspace={workspace} />}
        {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
        <div className="flex-1" />
        {actions}
      </div>
    </header>
  );
}

interface SectionBarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  density?: Density;
  className?: string;
}

export function SectionBar({ left, right, density = "regular", className }: SectionBarProps) {
  const sectionHeight = densityClasses[density].section;

  return (
    <div className={cn("shrink-0 border-b border-border/80 px-4", sectionHeight, className)}>
      <div className="h-full flex items-center justify-between gap-3">{left}<div className="flex items-center gap-2">{right}</div></div>
    </div>
  );
}
