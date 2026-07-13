import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCurrentWorkspace, useProjects } from "@/stores";
import { useProjectSelectionStore } from "@/stores/project-selection";
import { StatePanel } from "@/components/ui/state-panel";
import { ProjectsBrowse, ProjectHome } from "@/components/projects";

/**
 * Projects — a single `/projects` route. With no selection it shows the
 * full-width "All projects" browse view; selecting a project (browse row,
 * sidebar PROJECTS section, or `?open=` from global search) swaps in its
 * ProjectHome. Selection lives in `useProjectSelectionStore`.
 */
export default function ProjectsPage() {
  const { t } = useTranslation();
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;
  const { data: projects = [] } = useProjects(currentWorkspaceId);

  const selectedProjectId = useProjectSelectionStore((s) => s.selectedProjectId);
  const setSelectedProject = useProjectSelectionStore((s) => s.setSelectedProject);

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
  // id (deleted project) falls back to the browse view. Workspace switches clear
  // the selection at the store level (slug ids collide across workspaces).
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
        <ProjectsBrowse workspaceId={currentWorkspaceId} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ProjectHome workspaceId={currentWorkspaceId} projectId={selectedProject.id} />
    </div>
  );
}
