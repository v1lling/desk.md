import { useMemo } from "react";
import { ContentExplorer, type ContentExplorerScope } from "@/components/docs";
import { useProjects, useCurrentWorkspace, WORKSPACE_LEVEL_PROJECT_ID } from "@/stores";
import { Badge } from "@/components/ui/badge";
import { Circle } from "lucide-react";

export default function DocsPage() {
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;
  const { data: projects = [] } = useProjects(currentWorkspaceId);

  // Build scopes: Workspace-level + all projects (sorted alphabetically)
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

    // Sort projects alphabetically and add as scopes
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

  const workspaceColor = currentWorkspace?.color || "#64748b";

  if (!currentWorkspaceId) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Select a workspace to view docs
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header with workspace context */}
      {currentWorkspace && (
        <div className="shrink-0 h-12 px-4 flex items-center gap-3 border-b">
          <Circle
            className="size-3 shrink-0"
            style={{ color: workspaceColor }}
            fill={workspaceColor}
          />
          <h1 className="text-base font-semibold">Docs</h1>
          <Badge variant="outline" className="text-xs font-normal">
            {currentWorkspace.name}
          </Badge>
        </div>
      )}

      <main className="flex-1 h-full overflow-hidden">
        <ContentExplorer scopes={scopes} defaultScopeId="_shared" />
      </main>
    </div>
  );
}
