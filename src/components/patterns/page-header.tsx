
/**
 * Page Header with Workspace Context
 *
 * Shows the page title with an optional workspace badge for explicit context.
 * Used on workspace-filtered pages (Tasks, Docs, Meetings).
 */

import { Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Workspace } from "@/types";

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Current workspace for context badge */
  workspace?: Workspace | null;
  /** Additional content (filters, actions) */
  children?: React.ReactNode;
  /** Optional subtitle */
  subtitle?: string;
}

// Default color when workspace has no color set
const DEFAULT_WORKSPACE_COLOR = "#64748b"; // slate-500

export function PageHeader({
  title,
  workspace,
  children,
  subtitle,
}: PageHeaderProps) {
  const workspaceColor = workspace?.color || DEFAULT_WORKSPACE_COLOR;

  return (
    <div className="shrink-0 border-b">
      {/* Main header row */}
      <div className="h-12 px-4 flex items-center gap-3">
        {/* Workspace color indicator */}
        {workspace && (
          <Circle
            className="size-3 shrink-0"
            style={{ color: workspaceColor }}
            fill={workspaceColor}
          />
        )}

        {/* Title */}
        <h1 className="text-base font-semibold">{title}</h1>

        {/* Workspace badge */}
        {workspace && (
          <Badge variant="outline" className="text-xs font-normal">
            {workspace.name}
          </Badge>
        )}

        {/* Optional subtitle */}
        {subtitle && (
          <span className="text-sm text-muted-foreground">{subtitle}</span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions slot */}
        {children}
      </div>
    </div>
  );
}

/**
 * Simpler header without workspace context
 * Used for Personal pages and Settings
 */
export function SimplePageHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="shrink-0 border-b">
      <div className="h-12 px-4 flex items-center gap-3">
        <h1 className="text-base font-semibold">{title}</h1>
        <div className="flex-1" />
        {children}
      </div>
    </div>
  );
}
