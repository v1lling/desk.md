import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatePanel } from "@/components/ui/state-panel";
import { FilteredListPage, ListRow } from "@/components/patterns";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/tree-count";
import { projectStatusDotColors, projectStatuses } from "@/lib/design-tokens";
import { countActiveTasks } from "@/lib/task-status";
import type { Project } from "@desk/core/types";
import { useProjects, useDeleteProject } from "@/stores";
import { useProjectSelectionStore } from "@/stores/project-selection";
import { NewProjectModal } from "./new-project-modal";

const ALL_STATUSES = "all";

interface ProjectsBrowseProps {
  workspaceId: string;
}

/**
 * Full-width "All projects" view shown at /projects when no project is
 * selected. Search + status filter + New Project; clicking a row selects the
 * project, which swaps this view for its ProjectHome.
 */
export function ProjectsBrowse({ workspaceId }: ProjectsBrowseProps) {
  const { t } = useTranslation();
  const { data: projects = [] } = useProjects(workspaceId);
  const deleteProject = useDeleteProject();
  const setSelectedProject = useProjectSelectionStore((s) => s.setSelectedProject);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const list = projects.filter((p) => {
      if (statusFilter !== ALL_STATUSES && p.status !== statusFilter) return false;
      return matchesSearch(searchQuery, p.name, p.description);
    });
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [projects, searchQuery, statusFilter]);

  const handleDelete = useCallback(async () => {
    if (!deletingProject) return;
    try {
      await deleteProject.mutateAsync({
        projectId: deletingProject.id,
        workspaceId: deletingProject.workspaceId,
      });
      toast.success(t("toasts.project.delete.success"));
      setDeletingProject(null);
    } catch (err) {
      console.error("Failed to delete project:", err);
      toast.error(t("toasts.project.delete.error"));
    }
  }, [deletingProject, deleteProject, t]);

  const isFiltering = searchQuery.trim() !== "" || statusFilter !== ALL_STATUSES;

  return (
    <FilteredListPage
      actionLabel={t("pages.projects.browse.newProject")}
      onAction={() => setNewProjectOpen(true)}
      filters={[
        {
          id: "status",
          label: t("pages.projects.browse.statusLabel"),
          value: statusFilter,
          onChange: setStatusFilter,
          options: projectStatuses.map((value) => ({
            value,
            label: t(`entities.project.status.${value}`),
          })),
          allLabel: t("pages.projects.browse.allStatuses"),
          width: "w-[160px]",
        },
      ]}
      count={filtered.length}
      countLabel={t("pages.projects.browse.countLabel")}
      modal={
        <>
          <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
          <ConfirmDialog
            open={!!deletingProject}
            onOpenChange={(open) => !open && setDeletingProject(null)}
            title={t("pages.projects.deleteConfirmTitle")}
            description={t("pages.projects.deleteConfirmDescription", {
              name: deletingProject?.name ?? "",
            })}
            confirmLabel={t("common.buttons.delete")}
            variant="destructive"
            onConfirm={handleDelete}
          />
        </>
      }
    >
      <div className="max-w-3xl">
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder={t("pages.projects.browse.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchQuery("");
            }}
            className="h-8 pl-8 pr-8 text-sm"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 size-6 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        {filtered.length === 0 ? (
          <StatePanel
            variant="empty"
            display="inline"
            className="py-12"
            title={
              isFiltering
                ? t("emptyStates.projects.noMatches")
                : t("emptyStates.projects.noProjects")
            }
          />
        ) : (
          <div className="-mx-4">
            {filtered.map((project) => {
              const activeTasks = countActiveTasks(project.tasksByStatus);
              return (
                <ListRow
                  key={project.id}
                  onClick={() => setSelectedProject(project.id)}
                  className="py-2"
                  leading={
                    <span
                      className={cn(
                        "size-2 rounded-full shrink-0",
                        projectStatusDotColors[project.status],
                        project.description && "mt-2",
                      )}
                      title={t(`entities.project.status.${project.status}`)}
                    />
                  }
                  title={project.name}
                  meta={
                    <>
                      <CheckSquare className="size-3" />
                      {activeTasks}
                    </>
                  }
                  secondLine={project.description || undefined}
                  menuItems={
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
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </FilteredListPage>
  );
}
