import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CheckSquare,
  ChevronsUpDown,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types";
import { useProjects, useDeleteProject } from "@/stores";
import { useProjectSelectionStore } from "@/stores/project-selection";
import { NewProjectModal } from "./new-project-modal";

const ALL_STATUSES = "all";

/** Solid dot colors — `statusColors` tokens are badge bundles, not a plain dot color. */
const statusDotColors: Record<ProjectStatus, string> = {
  active: "bg-emerald-500",
  paused: "bg-amber-500",
  completed: "bg-blue-500",
  archived: "bg-slate-400",
};

const statusFilterValues: ProjectStatus[] = ["active", "paused", "completed", "archived"];

interface ProjectsTreePaneProps {
  workspaceId: string;
}

export function ProjectsTreePane({ workspaceId }: ProjectsTreePaneProps) {
  const { t } = useTranslation();
  const { data: projects = [] } = useProjects(workspaceId);
  const deleteProject = useDeleteProject();
  const selectedProjectId = useProjectSelectionStore((s) => s.selectedProjectId);
  const setSelectedProject = useProjectSelectionStore((s) => s.setSelectedProject);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = projects.filter((p) => {
      if (statusFilter !== ALL_STATUSES && p.status !== statusFilter) return false;
      if (q) {
        if (!p.name.toLowerCase().includes(q) && !p.description?.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
    list.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [projects, searchQuery, statusFilter, sortDir]);

  const handleDelete = useCallback(async () => {
    if (!deletingProject) return;
    try {
      await deleteProject.mutateAsync({
        projectId: deletingProject.id,
        workspaceId: deletingProject.workspaceId,
      });
      if (selectedProjectId === deletingProject.id) setSelectedProject(null);
      toast.success(t("toasts.project.delete.success"));
      setDeletingProject(null);
    } catch (err) {
      console.error("Failed to delete project:", err);
      toast.error(t("toasts.project.delete.error"));
    }
  }, [deletingProject, deleteProject, selectedProjectId, setSelectedProject, t]);

  const isFiltering = searchQuery.trim() !== "" || statusFilter !== ALL_STATUSES;

  return (
    <div className="flex flex-col h-full">
      {/* Header: search + sort + more */}
      <div className="shrink-0 min-h-11 py-2 px-3 border-b border-border/60 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder={t("pages.projects.tree.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchQuery("");
            }}
            className="h-7 pl-7 pr-7 text-xs"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-1/2 -translate-y-1/2 size-6 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              title={t("pages.projects.tree.sortTitle")}
            >
              <ChevronsUpDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => setSortDir("asc")}
              className={cn(sortDir === "asc" && "bg-accent")}
            >
              <ArrowDownAZ className="size-4 mr-2" />
              {t("pages.projects.tree.sortAsc")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortDir("desc")}
              className={cn(sortDir === "desc" && "bg-accent")}
            >
              <ArrowUpAZ className="size-4 mr-2" />
              {t("pages.projects.tree.sortDesc")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setNewProjectOpen(true)}>
              <Plus className="size-4 mr-2" />
              {t("pages.projects.tree.newProject")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Status filter */}
      <div className="shrink-0 px-3 py-2 border-b border-border/40">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="xs" className="h-7 w-full text-xs">
            <SelectValue placeholder={t("pages.projects.tree.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>{t("pages.projects.tree.allStatuses")}</SelectItem>
            {statusFilterValues.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`entities.project.status.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Action row: count + new project */}
      <div className="shrink-0 px-3 py-1 flex items-center gap-2 border-b border-border/40">
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("pages.projects.tree.projectCount", { count: filtered.length })}
        </span>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setNewProjectOpen(true)}
        >
          <Plus className="size-3.5 mr-1" />
          {t("pages.projects.tree.newProject")}
        </Button>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-xs text-muted-foreground text-center">
              {isFiltering
                ? t("emptyStates.projects.noMatches")
                : t("emptyStates.projects.noProjects")}
            </div>
          ) : (
            filtered.map((project) => {
              const isActive = project.id === selectedProjectId;
              const activeTasks = project.tasksByStatus
                ? project.tasksByStatus.todo +
                  project.tasksByStatus.doing +
                  project.tasksByStatus.waiting
                : 0;
              return (
                <div
                  key={project.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-sm mx-1",
                    "hover:bg-accent/40",
                    isActive && "bg-accent",
                  )}
                  onClick={() => setSelectedProject(project.id)}
                >
                  <span
                    className={cn(
                      "size-2 rounded-full shrink-0",
                      statusDotColors[project.status],
                    )}
                    title={t(`entities.project.status.${project.status}`)}
                  />
                  <span className="text-sm truncate flex-1">{project.name}</span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70 tabular-nums shrink-0">
                    <CheckSquare className="size-3" />
                    {activeTasks}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProject(project);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 mr-2" />
                        {t("common.buttons.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />

      <ConfirmDialog
        open={!!deletingProject}
        onOpenChange={(open) => !open && setDeletingProject(null)}
        title={t("pages.projects.tree.deleteConfirmTitle")}
        description={t("pages.projects.tree.deleteConfirmDescription", { name: deletingProject?.name ?? "" })}
        confirmLabel={t("common.buttons.delete")}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
