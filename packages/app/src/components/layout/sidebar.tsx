/**
 * Sidebar - enterprise navigation contract.
 */

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Settings,
  CheckSquare,
  Calendar,
  CalendarDays,
  Home,
  FileText,
  FolderKanban,
  Plus,
  Search,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentWorkspace } from "@/stores/workspaces";
import { useTasks } from "@/stores/tasks";
import { useWorkspaceOverviewShell } from "@/stores/content";
import { useMeetings } from "@/stores/meetings";
import { countTreeFiles } from "@/lib/tree-count";
import { useProjects } from "@/stores/projects";
import { useProjectSelectionStore } from "@/stores/project-selection";
import { projectStatusDotColors } from "@/lib/design-tokens";
import { countActiveTasks, isActiveStatus } from "@/lib/task-status";
import { SectionLabel } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { NewProjectModal } from "@/components/projects/new-project-modal";
import { WorkspaceSelector } from "./workspace-selector";
import { useTabStore } from "@/stores/tabs";
import { openGlobalSearch } from "@/components/global-search";
import { SidebarNavRow } from "./sidebar-nav-row";

interface SidebarProps {
  width: number;
  isCollapsed: boolean;
  isDragging?: boolean;
}

/** Sidebar shows the most recent few; "All projects" covers the rest. */
const SIDEBAR_PROJECT_CAP = 8;

function Divider() {
  return <div className="h-px bg-sidebar-border/60 my-2 mx-2" />;
}

export function Sidebar({ width, isCollapsed, isDragging }: SidebarProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const currentWorkspace = useCurrentWorkspace();
  const workspaceId = currentWorkspace?.id || null;

  const { data: tasks = [] } = useTasks(workspaceId);
  const { data: overviewTree = [] } = useWorkspaceOverviewShell(workspaceId);
  const { data: meetings = [] } = useMeetings(workspaceId);
  const { data: projects = [] } = useProjects(workspaceId);

  const activeTaskCount = tasks.filter((t) => isActiveStatus(t.status)).length;
  const totalFiles = useMemo(() => countTreeFiles(overviewTree), [overviewTree]);
  const meetingCount = meetings.length;
  const projectCount = projects.length;

  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const switchToDesk = useCallback(() => setActiveTab("desk"), [setActiveTab]);

  const selectedProjectId = useProjectSelectionStore((s) => s.selectedProjectId);
  const setSelectedProject = useProjectSelectionStore((s) => s.setSelectedProject);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  // Active projects only, most recently touched first, capped — "All projects"
  // covers the rest. Recency is the latest `updated` stamp across the tasks and
  // meetings already fetched above, so it costs no extra reads; docs are not a
  // signal here, meaning a doc save does not reorder the list. Projects with no
  // stamped item sort last, A-Z.
  const sidebarProjects = useMemo(() => {
    const lastTouched = new Map<string, string>();
    const bump = (projectId: string, stamp: string | undefined) => {
      if (!stamp) return; // undated items carry no recency signal
      const prev = lastTouched.get(projectId);
      if (!prev || stamp > prev) lastTouched.set(projectId, stamp);
    };
    for (const task of tasks) bump(task.projectId, task.updated ?? task.created);
    for (const meeting of meetings) bump(meeting.projectId, meeting.updated ?? meeting.created);

    return projects
      .filter((p) => p.status === "active")
      .sort((a, b) => {
        const ta = lastTouched.get(a.id) ?? "";
        const tb = lastTouched.get(b.id) ?? "";
        if (ta !== tb) return tb.localeCompare(ta);
        return a.name.localeCompare(b.name);
      })
      .slice(0, SIDEBAR_PROJECT_CAP);
  }, [projects, tasks, meetings]);

  const collapsed = isCollapsed;

  return (
    <aside
      data-app-chrome
      className={cn(
        "flex flex-col h-full min-h-0 bg-sidebar",
        !isDragging && "transition-[width] duration-200"
      )}
      style={{ width: `${width}px` }}
    >
      <ScrollArea className="flex-1 min-h-0">
        <nav className="px-2 py-2 space-y-1">
          {collapsed && (
            <SidebarNavRow label={t("nav.sidebar.search")} icon={Search} collapsed={collapsed} role="global" onClick={openGlobalSearch} />
          )}
          <SidebarNavRow to="/" label={t("nav.sidebar.dashboard")} icon={Home} active={pathname === "/"} collapsed={collapsed} role="global" onClick={switchToDesk} />
          <SidebarNavRow to="/planner" label={t("nav.sidebar.planner")} icon={CalendarDays} active={pathname === "/planner"} collapsed={collapsed} role="global" onClick={switchToDesk} />

          <Divider />

          {!collapsed && (
            <SectionLabel className="px-2.5 pb-0.5 text-[10px] tracking-wider text-sidebar-foreground/45">
              {t("nav.sidebar.workspaceViews")}
            </SectionLabel>
          )}

          <div className="space-y-0.5">
            <SidebarNavRow to="/tasks" label={t("nav.sidebar.tasks")} icon={CheckSquare} active={pathname === "/tasks"} collapsed={collapsed} role="global" count={activeTaskCount} onClick={switchToDesk} />
            <SidebarNavRow to="/docs" label={t("nav.sidebar.docs")} icon={FileText} active={pathname === "/docs"} collapsed={collapsed} role="global" count={totalFiles} onClick={switchToDesk} />
            <SidebarNavRow to="/meetings" label={t("nav.sidebar.meetings")} icon={Calendar} active={pathname === "/meetings"} collapsed={collapsed} role="global" count={meetingCount} onClick={switchToDesk} />
          </div>

          <Divider />

          {/* Collapsed: the PROJECTS section can't render, so a single icon row
              keeps the browse view (and every project) reachable. */}
          {collapsed && (
            <SidebarNavRow
              to="/projects"
              label={t("nav.sidebar.projectsSection")}
              icon={FolderKanban}
              active={pathname.startsWith("/projects")}
              collapsed
              role="global"
              onClick={() => {
                setSelectedProject(null);
                switchToDesk();
              }}
            />
          )}

          {!collapsed && (
            <div className="group/projects">
              <SectionLabel
                className="px-2.5 pb-0.5 text-[10px] tracking-wider text-sidebar-foreground/45"
                end={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 -my-1 text-sidebar-foreground/50 hover:text-sidebar-foreground opacity-0 group-hover/projects:opacity-100 transition-opacity"
                    title={t("nav.sidebar.newProject")}
                    onClick={() => setNewProjectOpen(true)}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                }
              >
                {t("nav.sidebar.projectsSection")}
              </SectionLabel>

              <div className="space-y-0.5">
                {sidebarProjects.map((project) => {
                  const activeTasks = countActiveTasks(project.tasksByStatus);
                  return (
                    <SidebarNavRow
                      key={project.id}
                      to="/projects"
                      role="project"
                      dot={projectStatusDotColors[project.status]}
                      label={project.name}
                      count={activeTasks}
                      active={pathname.startsWith("/projects") && selectedProjectId === project.id}
                      onClick={() => {
                        setSelectedProject(project.id);
                        switchToDesk();
                      }}
                    />
                  );
                })}
                {/* Always present: the only route to the browse view (archived and
                    paused projects, delete, filter) now that the nav row is gone. */}
                <SidebarNavRow
                  to="/projects"
                  role="subitem"
                  label={t("nav.sidebar.allProjects")}
                  count={projectCount}
                  active={pathname.startsWith("/projects") && !selectedProjectId}
                  onClick={() => {
                    setSelectedProject(null);
                    switchToDesk();
                  }}
                />
              </div>

              <Divider />
            </div>
          )}
        </nav>
      </ScrollArea>

      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />

      <div className="shrink-0 px-2 pb-1 pt-1.5 border-t border-sidebar-border/60 space-y-0.5">
        <SidebarNavRow to="/settings" label={t("nav.sidebar.settings")} icon={Settings} active={pathname === "/settings"} collapsed={collapsed} role="global" onClick={switchToDesk} />
      </div>

      <WorkspaceSelector isCollapsed={collapsed} />
    </aside>
  );
}
