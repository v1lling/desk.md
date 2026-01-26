"use client";

import { useMemo } from "react";
import { DocExplorer, type DocExplorerScope } from "@/components/docs";
import { useProjects, useCurrentWorkspace } from "@/stores";

export function DocsPageClient() {
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;
  const { data: projects = [] } = useProjects(currentWorkspaceId);

  // Build scopes: Workspace-level + all projects (sorted alphabetically)
  const scopes: DocExplorerScope[] = useMemo(() => {
    if (!currentWorkspaceId || !currentWorkspace) return [];

    const scopeList: DocExplorerScope[] = [
      {
        id: "_workspace",
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
      <main className="flex-1 h-full overflow-hidden">
        <DocExplorer scopes={scopes} defaultScopeId="_shared" />
      </main>
    </div>
  );
}
