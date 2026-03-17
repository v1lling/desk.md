import { useMemo } from "react";
import { ContentExplorer, type ContentExplorerScope } from "@/components/docs";
import { useProjects, useCurrentWorkspace, WORKSPACE_LEVEL_PROJECT_ID } from "@/stores";
import { StatePanel } from "@/components/ui/state-panel";

export default function DocsPage() {
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;
  const { data: projects = [] } = useProjects(currentWorkspaceId);

  const scopes: ContentExplorerScope[] = useMemo(() => {
    if (!currentWorkspaceId || !currentWorkspace) return [];

    const scopeList: ContentExplorerScope[] = [
      {
        id: WORKSPACE_LEVEL_PROJECT_ID,
        label: `${currentWorkspace.name} (Workspace)`,
        scope: "workspace",
        workspaceId: currentWorkspaceId,
        isWorkspaceLevel: true,
      },
    ];

    const sortedProjects = [...projects].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    for (const project of sortedProjects) {
      scopeList.push({
        id: project.id,
        label: project.name,
        scope: "project",
        workspaceId: currentWorkspaceId,
        projectId: project.id,
      });
    }

    return scopeList;
  }, [currentWorkspaceId, currentWorkspace, projects]);

  if (!currentWorkspaceId || !currentWorkspace) {
    return (
      <div className="flex flex-col h-full p-4">
        <StatePanel
          variant="empty"
          title="Select a workspace"
          description="Choose a workspace in the sidebar to view docs."
          className="h-full"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <main className="flex-1 h-full overflow-hidden">
        <ContentExplorer scopes={scopes} defaultScopeId={WORKSPACE_LEVEL_PROJECT_ID} />
      </main>
    </div>
  );
}
