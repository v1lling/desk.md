"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { DocList, DocEditor, NewDocModal } from "@/components/docs";
import { EntityFilterBar } from "@/components/ui/entity-filter-bar";
import { useDocs, useProjects, useCurrentWorkspace } from "@/stores";
import { FolderKanban } from "lucide-react";
import type { Doc } from "@/types";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function DocsPage() {
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;
  const { data: docs = [], isLoading } = useDocs(currentWorkspaceId);
  const { data: projects = [] } = useProjects(currentWorkspaceId);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [showNewDoc, setShowNewDoc] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [filterProject, setFilterProject] = useState<string>("all");

  // Handle ?open= query param from search navigation
  useEffect(() => {
    const openDocId = searchParams.get("open");
    if (openDocId && docs.length > 0) {
      const docToOpen = docs.find((d) => d.id === openDocId);
      if (docToOpen) {
        setSelectedDoc(docToOpen);
        // Clear the URL param after opening
        router.replace("/docs", { scroll: false });
      }
    }
  }, [searchParams, docs, router]);

  const handleDocClick = (doc: Doc) => {
    setSelectedDoc(doc);
  };

  // Filter and group docs by project
  const filteredDocs = useMemo(() => {
    if (filterProject === "all") return docs;
    return docs.filter((doc) => doc.projectId === filterProject);
  }, [docs, filterProject]);

  // Group docs by project for display
  const groupedDocs = useMemo(() => {
    const groups: Record<string, Doc[]> = {};
    filteredDocs.forEach((doc) => {
      const key = doc.projectId;
      if (!groups[key]) groups[key] = [];
      groups[key].push(doc);
    });
    return groups;
  }, [filteredDocs]);

  const getProjectName = (projectId: string) => {
    if (projectId === "_unassigned") return "No project";
    const project = projects.find((p) => p.id === projectId);
    return project?.name || projectId;
  };

  // Prepare filter options - include "No project" for unassigned
  const projectOptions = useMemo(
    () => [
      { value: "_unassigned", label: "No project" },
      ...projects.map((p) => ({ value: p.id, label: p.name })),
    ],
    [projects]
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Docs"
        action={{
          label: "New Doc",
          onClick: () => setShowNewDoc(true),
        }}
      />

      {/* Filter Bar */}
      <EntityFilterBar
        filters={[
          {
            id: "project",
            label: "Project",
            value: filterProject,
            onChange: setFilterProject,
            options: projectOptions,
            allLabel: "All projects",
            width: "w-[200px]",
          },
        ]}
        count={filteredDocs.length}
        countLabel="docs"
      />

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-muted-foreground">
              Loading docs...
            </div>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No docs found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {filterProject !== "all"
                ? "Try selecting a different project or create a new doc"
                : "Create your first doc to get started"}
            </p>
          </div>
        ) : filterProject === "all" ? (
          // Grouped view when showing all
          <div className="space-y-8">
            {Object.entries(groupedDocs).map(([projectId, projectDocs]) => (
              <div key={projectId}>
                <div className="flex items-center gap-2 mb-4">
                  <FolderKanban className="h-4 w-4 text-muted-foreground" />
                  {projectId === "_unassigned" ? (
                    <span className="font-medium text-muted-foreground">
                      {getProjectName(projectId)}
                    </span>
                  ) : (
                    <Link
                      href={`/projects/view?id=${projectId}`}
                      className="font-medium hover:underline"
                    >
                      {getProjectName(projectId)}
                    </Link>
                  )}
                  <Badge variant="outline" className="ml-2">
                    {projectDocs.length}
                  </Badge>
                </div>
                <DocList docs={projectDocs} onDocClick={handleDocClick} />
              </div>
            ))}
          </div>
        ) : (
          // Simple list when filtered
          <DocList docs={filteredDocs} onDocClick={handleDocClick} />
        )}
      </main>

      <DocEditor
        doc={selectedDoc}
        open={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
      />

      <NewDocModal open={showNewDoc} onClose={() => setShowNewDoc(false)} />
    </div>
  );
}
