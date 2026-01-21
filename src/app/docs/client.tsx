"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { DocTree, DocList, DocEditor, NewDocModal, DocDropZone } from "@/components/docs";
import { EntityFilterBar } from "@/components/ui/entity-filter-bar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  useDocs,
  useProjects,
  useCurrentWorkspace,
  useDocTree,
  useCreateDocFolder,
  useRenameDocFolder,
  useDeleteDocFolder,
  useCreateDocInFolder,
  useImportDocs,
  useExpandedDocFolders,
} from "@/stores";
import { FolderKanban } from "lucide-react";
import { toast } from "sonner";
import type { Doc } from "@/types";
import Link from "next/link";

export function DocsPageClient() {
  const currentWorkspace = useCurrentWorkspace();
  const currentWorkspaceId = currentWorkspace?.id || null;

  // Workspace-level docs (tree)
  const {
    data: workspaceTree = [],
    isLoading: treeLoading,
  } = useDocTree("workspace", currentWorkspaceId);

  // Project docs (flat, grouped)
  const { data: projectDocs = [], isLoading: projectDocsLoading } = useDocs(currentWorkspaceId);
  const { data: projects = [] } = useProjects(currentWorkspaceId);

  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"workspace" | "all">("workspace");
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newDocFolderPath, setNewDocFolderPath] = useState<string | undefined>();
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [filterProject, setFilterProject] = useState<string>("all");

  // Folder mutations
  const createFolder = useCreateDocFolder();
  const renameFolder = useRenameDocFolder();
  const deleteFolder = useDeleteDocFolder();
  const createDocInFolder = useCreateDocInFolder();
  const importDocs = useImportDocs();

  // Persisted expanded folders state for workspace docs
  const { expandedFolders, setExpandedFolders } = useExpandedDocFolders(
    currentWorkspaceId,
    null // workspace-level, not project-level
  );

  // Handle ?open= query param from search navigation
  useEffect(() => {
    const openDocId = searchParams.get("open");
    if (openDocId && projectDocs.length > 0) {
      const docToOpen = projectDocs.find((d) => d.id === openDocId);
      if (docToOpen) {
        setSelectedDoc(docToOpen);
        setActiveTab("all"); // Switch to all tab to show project docs
        router.replace("/docs", { scroll: false });
      }
    }
  }, [searchParams, projectDocs, router]);

  const handleDocClick = (doc: Doc) => {
    setSelectedDoc(doc);
  };

  // Filter and group docs by project for "All" tab
  const filteredDocs = useMemo(() => {
    if (filterProject === "all") return projectDocs;
    return projectDocs.filter((doc) => doc.projectId === filterProject);
  }, [projectDocs, filterProject]);

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

  const projectOptions = useMemo(
    () => [
      { value: "_unassigned", label: "No project" },
      ...projects.map((p) => ({ value: p.id, label: p.name })),
    ],
    [projects]
  );

  // Folder operations for workspace tree
  const handleCreateFolder = useCallback(
    async (parentPath: string, name: string) => {
      if (!currentWorkspaceId) return;
      const fullPath = parentPath ? `${parentPath}/${name}` : name;
      await createFolder.mutateAsync({
        scope: "workspace",
        folderPath: fullPath,
        workspaceId: currentWorkspaceId,
      });
    },
    [currentWorkspaceId, createFolder]
  );

  const handleRenameFolder = useCallback(
    async (path: string, newName: string) => {
      if (!currentWorkspaceId) return;
      await renameFolder.mutateAsync({
        scope: "workspace",
        oldPath: path,
        newName,
        workspaceId: currentWorkspaceId,
      });
    },
    [currentWorkspaceId, renameFolder]
  );

  const handleDeleteFolder = useCallback(
    async (path: string) => {
      if (!currentWorkspaceId) return;
      await deleteFolder.mutateAsync({
        scope: "workspace",
        folderPath: path,
        workspaceId: currentWorkspaceId,
      });
    },
    [currentWorkspaceId, deleteFolder]
  );

  const handleCreateDocInFolder = useCallback(
    (folderPath?: string) => {
      setNewDocFolderPath(folderPath);
      setShowNewDoc(true);
    },
    []
  );

  const handleNewDocClose = useCallback(() => {
    setShowNewDoc(false);
    setNewDocFolderPath(undefined);
  }, []);

  // Handle delete doc from tree
  const handleDeleteDoc = useCallback((doc: Doc) => {
    // This will be handled by the doc editor
    setSelectedDoc(doc);
  }, []);

  // Handle file drop for import
  const handleFilesDropped = useCallback(
    async (files: File[]) => {
      if (!currentWorkspaceId) return;

      try {
        // Read file contents
        const fileContents = await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            content: await file.text(),
          }))
        );

        await importDocs.mutateAsync({
          files: fileContents,
          scope: "workspace",
          workspaceId: currentWorkspaceId,
        });

        toast.success(`Imported ${files.length} doc${files.length > 1 ? "s" : ""}`);
      } catch (error) {
        console.error("Failed to import docs:", error);
        toast.error("Failed to import docs");
      }
    },
    [currentWorkspaceId, importDocs]
  );

  // Count for tabs
  const workspaceDocsCount = useMemo(() => {
    let count = 0;
    const countNodes = (nodes: typeof workspaceTree) => {
      for (const node of nodes) {
        if (node.type === "doc") count++;
        else if (node.type === "folder") countNodes(node.folder.children);
      }
    };
    countNodes(workspaceTree);
    return count;
  }, [workspaceTree]);

  const isLoading = activeTab === "workspace" ? treeLoading : projectDocsLoading;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Docs"
        action={{
          label: "New Doc",
          onClick: () => setShowNewDoc(true),
        }}
      />

      {/* Tabs */}
      <div className="border-b px-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "workspace" | "all")}>
          <TabsList className="h-10 bg-transparent p-0 gap-4">
            <TabsTrigger
              value="workspace"
              className="h-10 px-0 pb-3 pt-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              Workspace
              <Badge variant="secondary" className="ml-2">
                {workspaceDocsCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="h-10 px-0 pb-3 pt-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none"
            >
              All Projects
              <Badge variant="secondary" className="ml-2">
                {projectDocs.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "workspace" ? (
          // Workspace tree view - split into tree and editor
          <DocDropZone onFilesDropped={handleFilesDropped} className="flex h-full">
            {/* Tree sidebar */}
            <div className="w-64 border-r flex flex-col p-4">
              <DocTree
                nodes={workspaceTree}
                isLoading={treeLoading}
                selectedDocId={selectedDoc?.id}
                onSelectDoc={handleDocClick}
                onCreateDoc={handleCreateDocInFolder}
                onDeleteDoc={handleDeleteDoc}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                expandedFolders={expandedFolders}
                onExpandedFoldersChange={setExpandedFolders}
              />
            </div>

            {/* Editor area */}
            <div className="flex-1 p-6">
              {selectedDoc ? (
                <div className="h-full flex flex-col">
                  <p className="text-sm text-muted-foreground mb-2">
                    Editing: {selectedDoc.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Use the side panel or click edit to modify this doc.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-muted-foreground">Select a doc to view</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Drop files here to import, or create a new doc using the tree
                  </p>
                </div>
              )}
            </div>
          </DocDropZone>
        ) : (
          // All projects view - grouped list
          <div className="flex flex-col h-full">
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

            <div className="flex-1 overflow-auto p-6">
              {projectDocsLoading ? (
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
                <div className="space-y-8">
                  {Object.entries(groupedDocs).map(([projectId, projectDocsList]) => (
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
                          {projectDocsList.length}
                        </Badge>
                      </div>
                      <DocList docs={projectDocsList} onDocClick={handleDocClick} />
                    </div>
                  ))}
                </div>
              ) : (
                <DocList docs={filteredDocs} onDocClick={handleDocClick} />
              )}
            </div>
          </div>
        )}
      </main>

      <DocEditor
        doc={selectedDoc}
        open={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
      />

      <NewDocModal
        open={showNewDoc}
        onClose={handleNewDocClose}
        defaultScope={activeTab === "workspace" ? "workspace" : undefined}
        defaultFolderPath={newDocFolderPath}
      />
    </div>
  );
}
