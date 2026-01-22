"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocTree } from "./doc-tree";
import { DocInlineEditor } from "./doc-inline-editor";
import { NewDocModal } from "./new-doc-modal";
import { DocDropZone } from "./doc-drop-zone";
import {
  useDocTree,
  useCreateDocFolder,
  useRenameDocFolder,
  useDeleteDocFolder,
  useExpandedDocFolders,
  useImportDocs,
} from "@/stores";
import { toast } from "sonner";
import type { Doc, DocScope } from "@/types";

export interface DocExplorerScope {
  id: string;
  label: string;
  scope: DocScope;
  workspaceId?: string;
  projectId?: string;
  /** Mark as workspace-level scope (for visual differentiation) */
  isWorkspaceLevel?: boolean;
}

interface DocExplorerProps {
  /** Available scopes to show in dropdown. If only one, no dropdown shown. */
  scopes: DocExplorerScope[];
  /** Initially selected scope ID */
  defaultScopeId?: string;
  /** Callback when scope changes */
  onScopeChange?: (scopeId: string) => void;
  /** Class name for the container */
  className?: string;
  /** Width of the tree panel */
  treeWidth?: string;
}

/**
 * DocExplorer - Unified doc browsing component with scope selector
 *
 * Used for:
 * - Workspace docs page (dropdown: Shared + all projects)
 * - Personal docs page (single scope, no dropdown)
 * - Project docs tab (single scope, no dropdown)
 */
export function DocExplorer({
  scopes,
  defaultScopeId,
  onScopeChange,
  className,
  treeWidth = "w-64",
}: DocExplorerProps) {
  // Selected scope
  const [selectedScopeId, setSelectedScopeId] = useState(
    defaultScopeId || scopes[0]?.id
  );

  const selectedScope = useMemo(
    () => scopes.find((s) => s.id === selectedScopeId) || scopes[0],
    [scopes, selectedScopeId]
  );

  // Doc tree data for selected scope
  const { data: tree = [], isLoading } = useDocTree(
    selectedScope?.scope || "personal",
    selectedScope?.workspaceId,
    selectedScope?.projectId
  );

  // Expanded folders state
  const { expandedFolders, setExpandedFolders } = useExpandedDocFolders(
    selectedScope?.workspaceId || null,
    selectedScope?.projectId || null
  );

  // Mutations
  const createFolder = useCreateDocFolder();
  const renameFolder = useRenameDocFolder();
  const deleteFolder = useDeleteDocFolder();
  const importDocs = useImportDocs();

  // Local state
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newDocFolderPath, setNewDocFolderPath] = useState<string | undefined>();

  // Handle scope change
  const handleScopeChange = useCallback(
    (scopeId: string) => {
      setSelectedScopeId(scopeId);
      setSelectedDoc(null); // Clear selection when switching scope
      onScopeChange?.(scopeId);
    },
    [onScopeChange]
  );

  // Folder operations
  const handleCreateFolder = useCallback(
    async (parentPath: string, name: string) => {
      if (!selectedScope) return;
      const fullPath = parentPath ? `${parentPath}/${name}` : name;
      await createFolder.mutateAsync({
        scope: selectedScope.scope,
        folderPath: fullPath,
        workspaceId: selectedScope.workspaceId,
        projectId: selectedScope.projectId,
      });
    },
    [selectedScope, createFolder]
  );

  const handleRenameFolder = useCallback(
    async (path: string, newName: string) => {
      if (!selectedScope) return;
      await renameFolder.mutateAsync({
        scope: selectedScope.scope,
        oldPath: path,
        newName,
        workspaceId: selectedScope.workspaceId,
        projectId: selectedScope.projectId,
      });
    },
    [selectedScope, renameFolder]
  );

  const handleDeleteFolder = useCallback(
    async (path: string) => {
      if (!selectedScope) return;
      await deleteFolder.mutateAsync({
        scope: selectedScope.scope,
        folderPath: path,
        workspaceId: selectedScope.workspaceId,
        projectId: selectedScope.projectId,
      });
    },
    [selectedScope, deleteFolder]
  );

  // Doc operations
  const handleDocClick = useCallback((doc: Doc) => {
    setSelectedDoc(doc);
  }, []);

  const handleCreateDocInFolder = useCallback((folderPath?: string) => {
    setNewDocFolderPath(folderPath);
    setShowNewDoc(true);
  }, []);

  const handleDeleteDoc = useCallback((doc: Doc) => {
    // Open in editor where user can delete
    setSelectedDoc(doc);
  }, []);

  const handleNewDocClose = useCallback(() => {
    setShowNewDoc(false);
    setNewDocFolderPath(undefined);
  }, []);

  // Handle file drop for import
  const handleFilesDropped = useCallback(
    async (files: File[]) => {
      if (!selectedScope) return;

      try {
        const fileContents = await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            content: await file.text(),
          }))
        );

        await importDocs.mutateAsync({
          files: fileContents,
          scope: selectedScope.scope,
          workspaceId: selectedScope.workspaceId,
          projectId: selectedScope.projectId,
        });

        toast.success(`Imported ${files.length} doc${files.length > 1 ? "s" : ""}`);
      } catch (error) {
        console.error("Failed to import docs:", error);
        toast.error("Failed to import docs");
      }
    },
    [selectedScope, importDocs]
  );

  const showDropdown = scopes.length > 1;

  return (
    <DocDropZone
      onFilesDropped={handleFilesDropped}
      className={cn("flex h-full", className)}
    >
      {/* Tree panel */}
      <div className={cn("h-full border-r flex flex-col", treeWidth)}>
        {/* Scope dropdown */}
        {showDropdown && (
          <div className="shrink-0 px-4 py-2 border-b">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between"
                >
                  <span className="truncate">{selectedScope?.label}</span>
                  <ChevronDown className="size-4 shrink-0 ml-2 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {scopes.map((scope, index) => {
                  // Add separator after workspace-level scopes
                  const nextScope = scopes[index + 1];
                  const showSeparator =
                    scope.isWorkspaceLevel && nextScope && !nextScope.isWorkspaceLevel;

                  return (
                    <div key={scope.id}>
                      <DropdownMenuItem
                        onClick={() => handleScopeChange(scope.id)}
                        className={cn(
                          selectedScopeId === scope.id && "bg-accent",
                          scope.isWorkspaceLevel && "font-medium"
                        )}
                      >
                        {scope.label}
                      </DropdownMenuItem>
                      {showSeparator && <DropdownMenuSeparator />}
                    </div>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Doc tree */}
        <DocTree
          className="flex-1 min-h-0 px-4"
          nodes={tree}
          isLoading={isLoading}
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

      {/* Editor panel */}
      <div className="flex-1 h-full overflow-hidden">
        <DocInlineEditor
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
        />
      </div>

      {/* New doc modal */}
      <NewDocModal
        open={showNewDoc}
        onClose={handleNewDocClose}
        defaultScope={selectedScope?.scope}
        defaultWorkspaceId={selectedScope?.workspaceId}
        defaultProjectId={selectedScope?.projectId}
        defaultFolderPath={newDocFolderPath}
      />
    </DocDropZone>
  );
}
