
import { useState, useCallback, useMemo, forwardRef, useImperativeHandle, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContentTree } from "./content-tree";
import { NewDocModal } from "./new-doc-modal";
import { ContentDropZone } from "./content-drop-zone";
import {
  useContentTree,
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
  useDeleteDoc,
  useDeleteAsset,
  useExpandedFolders,
  useImportFiles,
  useOpenTab,
  useFolderAIStates,
  useMoveDoc,
  PERSONAL_WORKSPACE_ID,
} from "@/stores";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import type { Doc, ContentScope, Asset } from "@/types";
import { isMarkdownFile } from "@/lib/desk/file-utils";
import { extractDocs, extractAssets, extractFolderPaths } from "@/lib/desk/content";
import { getDocsPath } from "@/lib/desk/paths";
import { isTauri } from "@/lib/desk/tauri-fs";

export interface ContentExplorerScope {
  id: string;
  label: string;
  scope: ContentScope;
  workspaceId?: string;
  projectId?: string;
  /** Mark as workspace-level scope (for visual differentiation) */
  isWorkspaceLevel?: boolean;
}

/** Ref handle for ContentExplorer - allows parent to trigger actions when toolbar is hidden */
export interface ContentExplorerRef {
  /** Trigger file import dialog */
  triggerImport: () => void;
  /** Trigger new doc modal */
  triggerNewDoc: (folderPath?: string) => void;
}

interface ContentExplorerProps {
  /** Available scopes to show in dropdown. If only one, no dropdown shown. */
  scopes: ContentExplorerScope[];
  /** Initially selected scope ID */
  defaultScopeId?: string;
  /** Callback when scope changes */
  onScopeChange?: (scopeId: string) => void;
  /** Class name for the container */
  className?: string;
  /** Hide the toolbar (scope selector, doc count, action buttons). Use ref methods to trigger actions externally. */
  hideToolbar?: boolean;
}

/**
 * ContentExplorer - Full-width content browser with scope selector
 *
 * Docs open in tabs when clicked. Assets open externally. This component is purely for navigation.
 * Use ref to trigger import/new doc when toolbar is hidden.
 */
export const ContentExplorer = forwardRef<ContentExplorerRef, ContentExplorerProps>(function ContentExplorer({
  scopes,
  defaultScopeId,
  onScopeChange,
  className,
  hideToolbar,
}, ref) {
  // Selected scope
  const [selectedScopeId, setSelectedScopeId] = useState(
    defaultScopeId || scopes[0]?.id
  );

  const selectedScope = useMemo(
    () => scopes.find((s) => s.id === selectedScopeId) || scopes[0],
    [scopes, selectedScopeId]
  );

  // Content tree data for selected scope
  const { data: tree = [], isLoading } = useContentTree(
    selectedScope?.scope || "personal",
    selectedScope?.workspaceId,
    selectedScope?.projectId
  );

  // Count docs and assets in tree (using shared utility functions)
  const docCount = useMemo(() => extractDocs(tree).length, [tree]);
  const assetCount = useMemo(() => extractAssets(tree).length, [tree]);

  // Extract folder paths for AI state tracking
  const folderPaths = useMemo(() => extractFolderPaths(tree), [tree]);

  // Folder AI inclusion states
  const { folderAIStates, toggleFolderAI: toggleFolderAIRaw } = useFolderAIStates(
    folderPaths,
    selectedScope?.workspaceId,
    selectedScope?.scope || "personal",
    selectedScope?.projectId
  );

  // Wrap toggleFolderAI to show toast notifications
  const handleToggleFolderAI = useCallback(
    async (folderPath: string, currentlyIncluded: boolean) => {
      await toggleFolderAIRaw(folderPath, currentlyIncluded);
      const folderName = folderPath.includes("/") ? folderPath.split("/").pop() : folderPath;
      if (currentlyIncluded) {
        toast.success(`"${folderName}" excluded from AI`);
      } else {
        toast.success(`"${folderName}" included in AI`);
      }
    },
    [toggleFolderAIRaw]
  );

  // Expanded folders state - use PERSONAL_WORKSPACE_ID for personal scope
  const { expandedFolders, setExpandedFolders } = useExpandedFolders(
    selectedScope?.workspaceId || (selectedScope?.scope === "personal" ? PERSONAL_WORKSPACE_ID : null),
    selectedScope?.projectId || null
  );

  // Compute base path for "Reveal in Finder" functionality
  const [basePath, setBasePath] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!isTauri() || !selectedScope) {
      setBasePath(undefined);
      return;
    }

    getDocsPath(
      selectedScope.scope,
      selectedScope.workspaceId,
      selectedScope.projectId
    ).then(setBasePath).catch(() => setBasePath(undefined));
  }, [selectedScope]);

  // Mutations
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const deleteDoc = useDeleteDoc();
  const deleteAsset = useDeleteAsset();
  const importFiles = useImportFiles();
  const moveDoc = useMoveDoc();
  const { openDoc } = useOpenTab();

  // Local state
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newDocFolderPath, setNewDocFolderPath] = useState<string | undefined>();
  // Selection state - either a doc or a folder can be selected
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [deleteDocConfirm, setDeleteDocConfirm] = useState<Doc | null>(null);
  const [deleteAssetConfirm, setDeleteAssetConfirm] = useState<Asset | null>(null);

  // Handle scope change
  const handleScopeChange = useCallback(
    (scopeId: string) => {
      setSelectedScopeId(scopeId);
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

  // Move doc to a different folder
  const handleMoveDoc = useCallback(
    async (docId: string, fromPath: string, toPath: string) => {
      if (!selectedScope) return;
      await moveDoc.mutateAsync({
        scope: selectedScope.scope,
        docId,
        fromPath,
        toPath,
        workspaceId: selectedScope.workspaceId,
        projectId: selectedScope.projectId,
      });
    },
    [selectedScope, moveDoc]
  );

  // Selection and doc operations
  const handleDocClick = useCallback(
    (doc: Doc) => {
      setSelectedDocId(doc.id);
      setSelectedFolderPath(null); // Clear folder selection
      openDoc(doc);
    },
    [openDoc]
  );

  const handleFolderSelect = useCallback((folderPath: string) => {
    setSelectedFolderPath(folderPath);
    setSelectedDocId(null); // Clear doc selection
  }, []);

  const handleDeleteDoc = useCallback((doc: Doc) => {
    setDeleteDocConfirm(doc);
  }, []);

  const handleDeleteDocConfirm = useCallback(async () => {
    if (!deleteDocConfirm) return;
    try {
      await deleteDoc.mutateAsync(deleteDocConfirm);
      toast.success("Doc deleted");
      // Clear selection if deleted doc was selected
      if (selectedDocId === deleteDocConfirm.id) {
        setSelectedDocId(null);
      }
    } catch (error) {
      console.error("Failed to delete doc:", error);
      toast.error("Failed to delete doc");
    }
    setDeleteDocConfirm(null);
  }, [deleteDocConfirm, deleteDoc, selectedDocId]);

  const handleDeleteAsset = useCallback((asset: Asset) => {
    setDeleteAssetConfirm(asset);
  }, []);

  const handleDeleteAssetConfirm = useCallback(async () => {
    if (!deleteAssetConfirm) return;
    try {
      await deleteAsset.mutateAsync(deleteAssetConfirm);
      toast.success("File deleted");
    } catch (error) {
      console.error("Failed to delete file:", error);
      toast.error("Failed to delete file");
    }
    setDeleteAssetConfirm(null);
  }, [deleteAssetConfirm, deleteAsset]);

  const handleCreateDocInFolder = useCallback((folderPath?: string) => {
    setNewDocFolderPath(folderPath);
    setShowNewDoc(true);
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
        // Read files: markdown as text, others as binary
        const fileContents = await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            content: isMarkdownFile(file.name)
              ? await file.text()
              : new Uint8Array(await file.arrayBuffer()),
          }))
        );

        const result = await importFiles.mutateAsync({
          files: fileContents,
          scope: selectedScope.scope,
          workspaceId: selectedScope.workspaceId,
          projectId: selectedScope.projectId,
        });

        // Show success message with counts
        const importedDocs = result.docs.length;
        const importedAssets = result.assets.length;
        if (importedDocs > 0 && importedAssets > 0) {
          toast.success(`Imported ${importedDocs} doc${importedDocs > 1 ? "s" : ""} and ${importedAssets} file${importedAssets > 1 ? "s" : ""}`);
        } else if (importedDocs > 0) {
          toast.success(`Imported ${importedDocs} doc${importedDocs > 1 ? "s" : ""}`);
        } else if (importedAssets > 0) {
          toast.success(`Imported ${importedAssets} file${importedAssets > 1 ? "s" : ""}`);
        }
      } catch (error) {
        console.error("Failed to import files:", error);
        toast.error("Failed to import files");
      }
    },
    [selectedScope, importFiles]
  );

  // Trigger file input for import
  const handleImportClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    // Accept all files
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await handleFilesDropped(Array.from(files));
      }
    };
    input.click();
  }, [handleFilesDropped]);

  const showDropdown = scopes.length > 1;

  // Expose import/newDoc methods via ref for external controls
  useImperativeHandle(ref, () => ({
    triggerImport: handleImportClick,
    triggerNewDoc: (folderPath?: string) => {
      setNewDocFolderPath(folderPath);
      setShowNewDoc(true);
    },
  }), [handleImportClick]);

  return (
    <ContentDropZone
      onFilesDropped={handleFilesDropped}
      className={cn("flex flex-col h-full", className)}
    >
      {/* Header - hidden when hideToolbar is true */}
      {!hideToolbar && (
        <div className="shrink-0 px-6 py-4 border-b flex items-center gap-3">
          {/* Scope dropdown or title */}
          {showDropdown ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <span className="truncate">{selectedScope?.label}</span>
                  <ChevronDown className="size-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {scopes.map((scope, index) => {
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
          ) : (
            <h2 className="text-sm font-medium">{selectedScope?.label}</h2>
          )}

          {/* Doc count */}
          <span className="text-xs text-muted-foreground">
            {docCount} {docCount === 1 ? "doc" : "docs"}
            {assetCount > 0 && `, ${assetCount} ${assetCount === 1 ? "file" : "files"}`}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleImportClick}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Upload className="size-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowNewDoc(true)}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            <span>New Doc</span>
          </Button>
        </div>
      )}

      {/* Content tree - full width */}
      <ContentTree
        className="flex-1 min-h-0 px-6 py-4"
        nodes={tree}
        isLoading={isLoading}
        selectedDocId={selectedDocId}
        selectedFolderPath={selectedFolderPath}
        onSelectDoc={handleDocClick}
        onSelectFolder={handleFolderSelect}
        onCreateDoc={handleCreateDocInFolder}
        onDeleteDoc={handleDeleteDoc}
        onDeleteAsset={handleDeleteAsset}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        expandedFolders={expandedFolders}
        onExpandedFoldersChange={setExpandedFolders}
        onToggleFolderAI={handleToggleFolderAI}
        folderAIStates={folderAIStates}
        basePath={basePath}
        onMoveDoc={handleMoveDoc}
        allFolderPaths={folderPaths}
      />

      {/* New doc modal */}
      <NewDocModal
        open={showNewDoc}
        onClose={handleNewDocClose}
        defaultScope={selectedScope?.scope}
        defaultWorkspaceId={selectedScope?.workspaceId}
        defaultProjectId={selectedScope?.projectId}
        defaultFolderPath={newDocFolderPath}
      />

      {/* Delete doc confirmation */}
      <ConfirmDialog
        open={!!deleteDocConfirm}
        onOpenChange={(open) => !open && setDeleteDocConfirm(null)}
        title="Delete Doc"
        description={`Delete "${deleteDocConfirm?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteDocConfirm}
      />

      {/* Delete asset confirmation */}
      <ConfirmDialog
        open={!!deleteAssetConfirm}
        onOpenChange={(open) => !open && setDeleteAssetConfirm(null)}
        title="Delete File"
        description={`Delete "${deleteAssetConfirm?.id}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteAssetConfirm}
      />
    </ContentDropZone>
  );
});
