import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

type SidebarNavRole = "global" | "project";

interface SidebarNavRowProps {
  to?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  label: string;
  active?: boolean;
  role?: SidebarNavRole;
  collapsed?: boolean;
  count?: number;
  className?: string;
}

const roleClasses: Record<SidebarNavRole, string> = {
  global: "text-sm px-2.5 py-1.5",
  project: "text-sm px-2.5 py-1.5",
};

export function SidebarNavRow({
  to,
  onClick,
  icon: Icon,
  label,
  active = false,
  role = "global",
  collapsed = false,
  count,
  className,
}: SidebarNavRowProps) {
  const baseClass = cn(
    "flex items-center gap-2 rounded-md font-medium transition-colors",
    roleClasses[role],
    collapsed && "justify-center px-0",
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
    className
  );

  const content = (
    <>
      {Icon && (
        <Icon
          className={cn(
            "size-4 shrink-0",
            active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/60"
          )}
        />
      )}
      {!Icon && role === "project" && (
        // Neutral bullet, not a status dot: the sidebar lists active projects
        // only, so a status colour here would always be the same green. It just
        // marks the row and holds the label in the same column as the icon rows.
        <span className="size-4 shrink-0 flex items-center justify-center">
          <span
            className={cn("size-1.5 rounded-full bg-current", active ? "opacity-70" : "opacity-30")}
          />
        </span>
      )}
      {!collapsed && <span className="flex-1 truncate text-left">{label}</span>}
      {!collapsed && count !== undefined && count > 0 && (
        <span className="text-[10px] tabular-nums font-medium text-sidebar-foreground/50">{count}</span>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} onClick={onClick} className={baseClass} title={collapsed ? label : undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cn(baseClass, "w-full")} title={collapsed ? label : undefined}>
      {content}
    </button>
  );
}
