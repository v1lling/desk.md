"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  FolderKanban,
  FileText,
  Settings,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  StickyNote,
  User,
  Circle,
  Plus,
  Calendar,
  Home,
  ListTodo,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWorkspaces, useCurrentWorkspace } from "@/stores/workspaces";
import { useProjects } from "@/stores/projects";
import { useSettingsStore } from "@/stores/settings";
import { NewWorkspaceModal } from "@/components/workspaces/new-workspace-modal";
import { NewProjectModal } from "@/components/projects/new-project-modal";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LucideIcon } from "lucide-react";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

// Workspace-scoped navigation items (no Projects - they're shown inline)
const workspaceNavItems = [
  { href: "/tasks", label: "All Tasks", icon: ListTodo },
  { href: "/docs", label: "Docs", icon: FileText },
  { href: "/meetings", label: "Meetings", icon: Calendar },
] as const;

// Personal space navigation items (Inbox moved to Dashboard)
const personalNavItems = [
  { href: "/personal/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/personal/docs", label: "Docs", icon: StickyNote },
] as const;

// Default color when workspace has no color set
const DEFAULT_WORKSPACE_COLOR = "#64748b"; // slate-500

// Nav link component
function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  collapsed,
  indent = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  collapsed: boolean;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        indent && !collapsed && "pl-6",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          isActive
            ? "text-sidebar-accent-foreground"
            : "text-sidebar-foreground/60"
        )}
      />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

// Section header with collapse toggle
function SectionHeader({
  label,
  icon: Icon,
  isExpanded,
  onToggle,
  collapsed,
}: {
  label: string;
  icon: LucideIcon;
  isExpanded: boolean;
  onToggle: () => void;
  collapsed: boolean;
}) {
  if (collapsed) return null;

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider hover:text-sidebar-foreground/70 transition-colors"
    >
      <Icon className="size-3" />
      <span className="flex-1 text-left">{label}</span>
      {isExpanded ? (
        <ChevronDown className="size-3" />
      ) : (
        <ChevronRight className="size-3" />
      )}
    </button>
  );
}

// Workspace item in the list
function WorkspaceItem({
  workspace,
  isSelected,
  isExpanded,
  onSelect,
  onToggle,
  onNewProject,
  collapsed,
  pathname,
  searchParams,
}: {
  workspace: { id: string; name: string; color?: string };
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onNewProject: () => void;
  collapsed: boolean;
  pathname: string;
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const { data: projects = [] } = useProjects(isSelected ? workspace.id : null);
  const fillColor = workspace.color || DEFAULT_WORKSPACE_COLOR;

  // Sort projects alphabetically
  const sortedProjects = [...projects].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  if (collapsed) {
    return (
      <button
        onClick={onSelect}
        className={cn(
          "w-full flex items-center justify-center py-2 rounded-lg transition-colors",
          isSelected
            ? "bg-sidebar-accent/50"
            : "hover:bg-sidebar-accent/30"
        )}
        title={workspace.name}
      >
        <Circle
          className="size-4"
          style={{ color: fillColor }}
          fill={fillColor}
        />
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => {
          onSelect();
          if (!isExpanded) onToggle();
        }}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isSelected
            ? "bg-sidebar-accent/50 text-sidebar-foreground"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
        )}
      >
        <Circle
          className="size-3 shrink-0"
          style={{ color: fillColor }}
          fill={fillColor}
        />
        <span className="flex-1 text-left truncate">{workspace.name}</span>
        {isSelected && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onToggle();
              }
            }}
            className="p-0.5 hover:bg-sidebar-accent rounded cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="size-3 text-sidebar-foreground/50" />
            ) : (
              <ChevronRight className="size-3 text-sidebar-foreground/50" />
            )}
          </span>
        )}
      </button>

      {/* Workspace sub-nav */}
      {isSelected && isExpanded && (
        <div className="mt-1 space-y-0.5">
          {workspaceNavItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              isActive={pathname === item.href}
              collapsed={collapsed}
              indent
            />
          ))}

          {/* Projects section (expandable) */}
          <div>
            <button
              onClick={() => setProjectsExpanded(!projectsExpanded)}
              className={cn(
                "w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-lg text-sm font-medium transition-colors",
                "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <FolderKanban className="size-4 shrink-0 text-sidebar-foreground/60" />
              <span className="flex-1 text-left">Projects</span>
              {projectsExpanded ? (
                <ChevronDown className="size-3 text-sidebar-foreground/50" />
              ) : (
                <ChevronRight className="size-3 text-sidebar-foreground/50" />
              )}
            </button>

            {/* Project list */}
            {projectsExpanded && (
              <div className="mt-0.5 space-y-0.5">
                {sortedProjects.length === 0 ? (
                  <div className="pl-[3.25rem] pr-3 py-2 text-xs text-sidebar-foreground/40 italic">
                    No projects yet
                  </div>
                ) : (
                  sortedProjects.map((project) => {
                    const projectHref = `/projects/view?id=${project.id}`;
                    const isProjectActive = pathname === "/projects/view" &&
                      searchParams.get("id") === project.id;

                    return (
                      <Link
                        key={project.id}
                        href={projectHref}
                        className={cn(
                          "flex items-center gap-3 pl-6 pr-3 py-2 rounded-lg text-sm transition-colors",
                          isProjectActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm font-medium"
                            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                        )}
                      >
                        <span className="size-4 shrink-0 flex items-center justify-center">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              isProjectActive
                                ? "bg-sidebar-accent-foreground"
                                : "bg-sidebar-foreground/40"
                            )}
                          />
                        </span>
                        <span className="truncate">{project.name}</span>
                      </Link>
                    );
                  })
                )}
                {/* New Project button */}
                <button
                  onClick={onNewProject}
                  className="w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-lg text-sm text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors"
                >
                  <Plus className="size-4 shrink-0" />
                  <span>New Project</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: workspaces = [] } = useWorkspaces();
  const currentWorkspace = useCurrentWorkspace();
  const setCurrentWorkspaceId = useSettingsStore(
    (state) => state.setCurrentWorkspaceId
  );

  const [personalExpanded, setPersonalExpanded] = useState(true);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true);
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  return (
    <>
      <aside
        className={cn(
          "flex flex-col h-full min-h-0 bg-sidebar border-r border-sidebar-border transition-all duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header: Search + Collapse Toggle */}
        <div className="shrink-0 p-3 flex items-center gap-2 border-b border-sidebar-border/50">
          {!collapsed ? (
            <>
              <button
                onClick={() => {
                  const event = new KeyboardEvent("keydown", {
                    key: "k",
                    metaKey: true,
                    bubbles: true,
                  });
                  document.dispatchEvent(event);
                }}
                className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md bg-sidebar-accent/30 text-sidebar-foreground/50 text-sm hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/70 transition-colors"
              >
                <Search className="size-4" />
                <span className="flex-1 text-left">Search...</span>
                <kbd className="text-[10px] font-medium bg-sidebar-accent/50 px-1.5 py-0.5 rounded">
                  ⌘K
                </kbd>
              </button>
              {onToggle && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  className="size-8 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
                >
                  <ChevronLeft className="size-4" />
                </Button>
              )}
            </>
          ) : (
            <button
              onClick={() => {
                const event = new KeyboardEvent("keydown", {
                  key: "k",
                  metaKey: true,
                  bubbles: true,
                });
                document.dispatchEvent(event);
              }}
              className="w-full flex items-center justify-center py-1.5 rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground/70 transition-colors"
              title="Search (⌘K)"
            >
              <Search className="size-4" />
            </button>
          )}
        </div>

        {/* Main Navigation */}
        <ScrollArea className="flex-1 h-0">
          <nav className="px-3 py-3 space-y-4">
          {/* Dashboard - top level */}
          <div>
            <NavLink
              href="/"
              label="Dashboard"
              icon={Home}
              isActive={pathname === "/"}
              collapsed={collapsed}
            />
          </div>

          {/* Personal Section */}
          <div>
            <SectionHeader
              label="Personal"
              icon={User}
              isExpanded={personalExpanded}
              onToggle={() => setPersonalExpanded(!personalExpanded)}
              collapsed={collapsed}
            />
            {(personalExpanded || collapsed) && (
              <div className="mt-1 space-y-0.5">
                {personalNavItems.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    isActive={pathname === item.href}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Workspaces Section */}
          <div>
            {!collapsed && (
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
                <span>Workspaces</span>
              </div>
            )}
            <div className="mt-1 space-y-0.5">
              {workspaces.map((workspace) => (
                <WorkspaceItem
                  key={workspace.id}
                  workspace={workspace}
                  isSelected={currentWorkspace?.id === workspace.id}
                  isExpanded={workspaceExpanded}
                  onSelect={() => setCurrentWorkspaceId(workspace.id)}
                  onToggle={() => setWorkspaceExpanded(!workspaceExpanded)}
                  onNewProject={() => setShowNewProjectModal(true)}
                  collapsed={collapsed}
                  pathname={pathname}
                  searchParams={searchParams}
                />
              ))}

              {/* New Workspace button */}
              {!collapsed && (
                <button
                  onClick={() => setShowNewWorkspaceModal(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors"
                >
                  <Plus className="size-3" />
                  <span>New Workspace</span>
                </button>
              )}
              {collapsed && (
                <button
                  onClick={() => setShowNewWorkspaceModal(true)}
                  className="w-full flex items-center justify-center py-2 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors"
                  title="New Workspace"
                >
                  <Plus className="size-4" />
                </button>
              )}
            </div>
          </div>
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="shrink-0 px-3 pb-3 pt-2 border-t border-sidebar-border/50 space-y-1">
          <NavLink
            href="/settings"
            label="Settings"
            icon={Settings}
            isActive={pathname === "/settings"}
            collapsed={collapsed}
          />

          {/* Expand button - only shown when collapsed */}
          {collapsed && onToggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="w-full h-9 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30"
            >
              <ChevronLeft className="size-4 rotate-180" />
            </Button>
          )}
        </div>
      </aside>

      <NewWorkspaceModal
        open={showNewWorkspaceModal}
        onClose={() => setShowNewWorkspaceModal(false)}
      />

      <NewProjectModal
        open={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
      />
    </>
  );
}
