import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FolderKanban } from "lucide-react";
import { useCurrentWorkspace, useProjects } from "@/stores";
import { useProjectSelectionStore } from "@/stores/project-selection";
import { useSecondarySidebar } from "@/hooks/use-secondary-sidebar";
import { StatePanel } from "@/components/ui/state-panel";
import { ProjectsTreePane, ProjectOverview } from "@/components/projects";

/**
 * Projects Hub — a secondary-sidebar project list (`ProjectsTreePane`) plus a
 * project overview dashboard in the main pane. Single `/projects` route;
 * selection lives in `useProjectSelectionStore` so the sidebar slot key stays
 * stable (see `use-secondary-sidebar.ts`).
 */
export default function ProjectsPage() {
  const { t } = useTranslation();
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;
  const { data: projects = [] } = useProjects(currentWorkspaceId);

  const selectedProjectId = useProjectSelectionStore((s) => s.selectedProjectId);
  const setSelectedProject = useProjectSelectionStore((s) => s.setSelectedProject);

  // Register the projects tree as the secondary sidebar slot for /projects.
  const pane = useMemo(
    () => (currentWorkspaceId ? <ProjectsTreePane workspaceId={currentWorkspaceId} /> : null),
    [currentWorkspaceId],
  );
  useSecondarySidebar("/projects", pane);

  // Consume ?open=<id> (e.g. from global search) → select that project, clear param.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId) {
      setSelectedProject(openId);
      searchParams.delete("open");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, setSelectedProject]);

  // Resolve the selection against the current workspace's project list — a stale
  // id (deleted project, or workspace switched) falls back to the empty state.
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  if (!currentWorkspaceId) {
    return (
      <div className="flex flex-col h-full">
        <StatePanel
          variant="empty"
          display="inline"
          title={t("pages.projects.selectWorkspaceTitle")}
          description={t("pages.projects.selectWorkspaceDescription")}
          className="h-full"
        />
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="flex flex-col h-full">
        <StatePanel
          variant="empty"
          display="inline"
          icon={FolderKanban}
          title={projects.length === 0 ? t("pages.projects.noProjectsTitle") : t("pages.projects.selectProjectTitle")}
          description={
            projects.length === 0
              ? t("pages.projects.noProjectsDescription")
              : t("pages.projects.selectProjectDescription")
          }
          className="h-full"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ProjectOverview workspaceId={currentWorkspaceId} projectId={selectedProject.id} />
    </div>
  );
}
