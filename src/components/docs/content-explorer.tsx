
import { useState, useCallback, useMemo, forwardRef, useImperativeHandle, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Plus, Upload, Search, X, ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp01, ChevronsUpDown, FolderOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContentTree } from "./content-tree";
import { NewDocModal } from "./new-doc-modal";
import { ContentDropZone } from "./content-drop-zone";
import { revealInFinder, type DocSortBy } from "./tree-item-utils";
import {
  useContentTree,
  useWorkspaceOverviewShell,
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
  useDeleteDoc,
  useUpdateDoc,
  useDeleteAsset,
  useExpandedFolders,
  useImportFiles,
  useOpenTab,
  useFolderAIStates,
  useMoveDoc,
  useMoveFolder,
  PERSONAL_WORKSPACE_ID,
  contentKeys,
} from "@/stores";
import { useQueryClient } from "@tanstack/react-query";
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
  className,
  hideToolbar,
}, ref) {
  const queryClient = useQueryClient();

  // Selected scope
  const [selectedScopeId, setSelectedScopeId] = useState(
    defaultScopeId || scopes[0]?.id
  );

  const selectedScope = useMemo(
    () => scopes.find((s) => s.id === selectedScopeId) || scopes[0],
    [scopes, selectedScopeId]
  );

  // Overview mode: workspace-level scope shows workspace docs + project folders
  const isOverviewMode = selectedScope?.isWorkspaceLevel === true;

  // Content tree data — use overview shell for workspace scope, scoped tree otherwise
  const { data: overviewTree = [], isLoading: overviewLoading } =
    useWorkspaceOverviewShell(isOverviewMode ? selectedScope?.workspaceId : null);

  const { data: scopedTree = [], isLoading: scopedLoading } = useContentTree(
    selectedScope?.scope || "personal",
    isOverviewMode ? undefined : selectedScope?.workspaceId,
    isOverviewMode ? undefined : selectedScope?.projectId
  );

  const tree = isOverviewMode ? overviewTree : scopedTree;
  const isLoading = isOverviewMode ? overviewLoading : scopedLoading;

  // Total file count — workspace-level docs/assets + project stub counts
  const totalFiles = useMemo(() => {
    let count = 0;
    for (const node of tree) {
      if (node.type === "doc" || node.type === "asset") {
        count++;
      } else if (node.type === "folder" && node.folder.isProject) {
        // Project stubs have pre-computed counts (children are lazy-loaded)
        count += (node.folder.docCount ?? 0) + (node.folder.assetCount ?? 0);
      } else if (node.type === "folder") {
        // Regular folders: count recursively
        count += extractDocs([node]).length + extractAssets([node]).length;
      }
    }
    return count;
  }, [tree]);

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
  // Overview mode stores expanded folders at workspace level (null projectId)
  const { expandedFolders, setExpandedFolders } = useExpandedFolders(
    selectedScope?.workspaceId || (selectedScope?.scope === "personal" ? PERSONAL_WORKSPACE_ID : null),
    isOverviewMode ? null : selectedScope?.projectId || null
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

  // Search and sort state (lifted from ContentTree for header placement)
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<DocSortBy>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  }, []);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setSearchQuery("");
      searchInputRef.current?.focus();
    }
  }, []);

  // Mutations
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const deleteDoc = useDeleteDoc();
  const updateDoc = useUpdateDoc();
  const deleteAsset = useDeleteAsset();
  const importFiles = useImportFiles();
  const moveDoc = useMoveDoc();
  const moveFolder = useMoveFolder();
  const { openDoc } = useOpenTab();

  // Local state
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newDocFolderPath, setNewDocFolderPath] = useState<string | undefined>();
  // Selection state - either a doc or a folder can be selected
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [deleteDocConfirm, setDeleteDocConfirm] = useState<Doc | null>(null);
  const [deleteAssetConfirm, setDeleteAssetConfirm] = useState<Asset | null>(null);

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

  // Move folder to a different parent folder
  const handleMoveFolder = useCallback(
    async (fromPath: string, toParentPath: string) => {
      if (!selectedScope) return;
      await moveFolder.mutateAsync({
        scope: selectedScope.scope,
        fromPath,
        toParentPath,
        workspaceId: selectedScope.workspaceId,
        projectId: selectedScope.projectId,
      });
    },
    [selectedScope, moveFolder]
  );

  // Rename doc (title only)
  const handleRenameDoc = useCallback(
    async (doc: Doc, newTitle: string) => {
      await updateDoc.mutateAsync({ doc, updates: { title: newTitle } });
      toast.success("Renamed");
    },
    [updateDoc]
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
        <div className="shrink-0 h-11 px-4 border-b border-border/80 flex items-center gap-2">
          {/* Search input */}
          <div className="relative flex-1 max-w-[220px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="h-7 pl-7 pr-7 text-xs"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0.5 top-1/2 -translate-y-1/2 size-6 text-muted-foreground hover:text-foreground"
                onClick={handleClearSearch}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                title="Sort"
              >
                <ChevronsUpDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => { setSortBy("name"); setSortDir(prev => sortBy === "name" ? (prev === "asc" ? "desc" : "asc") : "asc"); }}
                className={cn(sortBy === "name" && "bg-accent")}
              >
                {sortBy === "name" && sortDir === "desc" ? <ArrowUpAZ className="size-4 mr-2" /> : <ArrowDownAZ className="size-4 mr-2" />}
                Name {sortBy === "name" ? (sortDir === "asc" ? "A-Z" : "Z-A") : ""}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { setSortBy("created"); setSortDir(prev => sortBy === "created" ? (prev === "asc" ? "desc" : "asc") : "desc"); }}
                className={cn(sortBy === "created" && "bg-accent")}
              >
                {sortBy === "created" && sortDir === "asc" ? <ArrowUp01 className="size-4 mr-2" /> : <ArrowDown01 className="size-4 mr-2" />}
                Created {sortBy === "created" ? (sortDir === "desc" ? "newest" : "oldest") : ""}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { setSortBy("modified"); setSortDir(prev => sortBy === "modified" ? (prev === "asc" ? "desc" : "asc") : "desc"); }}
                className={cn(sortBy === "modified" && "bg-accent")}
              >
                {sortBy === "modified" && sortDir === "asc" ? <ArrowUp01 className="size-4 mr-2" /> : <ArrowDown01 className="size-4 mr-2" />}
                Modified {sortBy === "modified" ? (sortDir === "desc" ? "newest" : "oldest") : ""}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* File count */}
          <span className="text-xs text-muted-foreground tabular-nums">
            {totalFiles} {totalFiles === 1 ? "file" : "files"}
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
        className="flex-1 min-h-0"
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
        onRenameDoc={handleRenameDoc}
        onMoveFolder={handleMoveFolder}
        workspaceId={selectedScope?.workspaceId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortDir={sortDir}
        onSortDirChange={setSortDir}
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
