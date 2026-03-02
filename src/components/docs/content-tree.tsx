"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { FolderPlus, FileText, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ContentTreeItem } from "./content-tree-item";
import type { Doc, FileTreeNode, ContentScope, Asset } from "@/types";
import { getNodeKey } from "@/lib/desk/content";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";

/**
 * Recursively filter tree nodes based on search query.
 * If a doc/asset matches, include it. If a folder contains matching items, include it with filtered children.
 */
function filterNodes(nodes: FileTreeNode[], query: string): FileTreeNode[] {
  if (!query.trim()) return nodes;

  const lowerQuery = query.toLowerCase();
  const result: FileTreeNode[] = [];

  for (const node of nodes) {
    if (node.type === "folder") {
      // Recursively filter folder children
      const filteredChildren = filterNodes(node.folder.children, query);
      // Include folder if it has matching children OR if folder name matches
      if (filteredChildren.length > 0 || node.folder.name.toLowerCase().includes(lowerQuery)) {
        result.push({
          type: "folder",
          folder: {
            ...node.folder,
            children: filteredChildren.length > 0 ? filteredChildren : node.folder.children,
          },
        });
      }
    } else if (node.type === "doc") {
      // Include doc if title matches
      if (node.doc.title.toLowerCase().includes(lowerQuery)) {
        result.push(node);
      }
    } else if (node.type === "asset") {
      // Include asset if filename matches
      if (node.asset.id.toLowerCase().includes(lowerQuery)) {
        result.push(node);
      }
    }
  }

  return result;
}

/**
 * Extract all folder paths from nodes (for auto-expanding during search)
 */
function getAllFolderPaths(nodes: FileTreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === "folder") {
      paths.push(node.folder.path);
      paths.push(...getAllFolderPaths(node.folder.children));
    }
  }
  return paths;
}

interface ContentTreeProps {
  nodes: FileTreeNode[];
  isLoading?: boolean;
  selectedDocId?: string | null;
  selectedFolderPath?: string | null;
  onSelectDoc?: (doc: Doc) => void;
  onSelectFolder?: (folderPath: string) => void;
  onCreateDoc?: (folderPath?: string) => void;
  onDeleteDoc?: (doc: Doc) => void;
  onDeleteAsset?: (asset: Asset) => void;
  onCreateFolder?: (parentPath: string, name: string) => Promise<void>;
  onRenameFolder?: (path: string, newName: string) => Promise<void>;
  onDeleteFolder?: (path: string) => Promise<void>;
  className?: string;
  // Optional controlled expanded state for persistence
  expandedFolders?: string[];
  onExpandedFoldersChange?: (folders: string[]) => void;
  /** Callback to toggle AI inclusion for a folder */
  onToggleFolderAI?: (folderPath: string, currentlyIncluded: boolean) => void;
  /** Map of folder paths to their AI inclusion state (true = included) */
  folderAIStates?: Map<string, boolean>;
  /** Base path for docs directory (used for Reveal in Finder) */
  basePath?: string;
  /** Callback when a doc is moved to a folder */
  onMoveDoc?: (docId: string, fromPath: string, toPath: string) => Promise<void>;
  /** All folder paths for "Move to" menu */
  allFolderPaths?: string[];
}

export function ContentTree({
  nodes,
  isLoading,
  selectedDocId,
  selectedFolderPath,
  onSelectDoc,
  onSelectFolder,
  onCreateDoc,
  onDeleteDoc,
  onDeleteAsset,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  className,
  expandedFolders: controlledExpandedFolders,
  onExpandedFoldersChange,
  onToggleFolderAI,
  folderAIStates,
  basePath,
  onMoveDoc,
  allFolderPaths,
}: ContentTreeProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop state
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    })
  );

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const docData = event.active.data.current?.doc as Doc | undefined;
    if (docData) {
      setActiveDoc(docData);
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setDropTargetPath(null);
      return;
    }

    // Check if over a folder or the root drop zone
    const targetPath = over.data.current?.folderPath as string | undefined;
    setDropTargetPath(targetPath ?? (over.id === "root-drop" ? "" : null));
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDoc(null);
    setDropTargetPath(null);

    if (!over || !onMoveDoc) return;

    const doc = active.data.current?.doc as Doc | undefined;
    if (!doc) return;

    // Determine target folder path
    const targetPath = over.data.current?.folderPath as string | undefined;
    const toPath = targetPath ?? (over.id === "root-drop" ? "" : null);

    if (toPath === null) return;

    // Get current folder path from doc.path
    const fromPath = doc.path?.includes("/")
      ? doc.path.substring(0, doc.path.lastIndexOf("/"))
      : "";

    // Don't move if same folder
    if (fromPath === toPath) return;

    try {
      await onMoveDoc(doc.id, fromPath, toPath);
    } catch (error) {
      console.error("Failed to move doc:", error);
    }
  }, [onMoveDoc]);

  const handleDragCancel = useCallback(() => {
    setActiveDoc(null);
    setDropTargetPath(null);
  }, []);

  // Track expanded folders - use controlled state if provided, otherwise local state
  const [localExpandedFolders, setLocalExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  // Store expanded folders before search to restore after
  const [preSearchExpandedFolders, setPreSearchExpandedFolders] = useState<string[] | null>(null);

  // Convert controlled array to Set for consistent usage
  const expandedFolders = controlledExpandedFolders
    ? new Set(controlledExpandedFolders)
    : localExpandedFolders;

  const setExpandedFolders = useCallback((update: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (onExpandedFoldersChange) {
      // Controlled mode - notify parent
      const newSet = typeof update === 'function'
        ? update(new Set(controlledExpandedFolders || []))
        : update;
      onExpandedFoldersChange(Array.from(newSet));
    } else {
      // Uncontrolled mode - use local state
      setLocalExpandedFolders(update);
    }
  }, [controlledExpandedFolders, onExpandedFoldersChange]);

  // Filter nodes based on search query
  const filteredNodes = useMemo(
    () => filterNodes(nodes, searchQuery),
    [nodes, searchQuery]
  );

  // Auto-expand all folders when searching, restore when search clears
  useEffect(() => {
    if (searchQuery.trim()) {
      // Save current expanded state before searching (only once when search starts)
      if (preSearchExpandedFolders === null) {
        setPreSearchExpandedFolders(Array.from(expandedFolders));
      }
      // Expand all folders in filtered results
      const allPaths = getAllFolderPaths(filteredNodes);
      setExpandedFolders(new Set(allPaths));
    } else if (preSearchExpandedFolders !== null) {
      // Restore previous expanded state when search clears
      setExpandedFolders(new Set(preSearchExpandedFolders));
      setPreSearchExpandedFolders(null);
    }
  }, [searchQuery, filteredNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear search handler
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  }, []);

  // Keyboard shortcut: Escape to clear search
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClearSearch();
    }
  }, [handleClearSearch]);

  // Modal state for creating/renaming folders
  const [folderModal, setFolderModal] = useState<{
    mode: "create" | "rename";
    parentPath: string; // For create, this is parent. For rename, this is the folder path.
    currentName?: string;
  } | null>(null);
  const [folderName, setFolderName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ path: string } | null>(null);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, [setExpandedFolders]);

  const handleNewRootFolder = () => {
    setFolderModal({ mode: "create", parentPath: "" });
    setFolderName("");
  };

  const handleNewSubfolder = (parentPath: string) => {
    setFolderModal({ mode: "create", parentPath });
    setFolderName("");
    // Expand parent folder
    setExpandedFolders((prev) => new Set([...prev, parentPath]));
  };

  const handleRenameFolder = (path: string) => {
    const name = path.includes("/") ? path.split("/").pop()! : path;
    setFolderModal({ mode: "rename", parentPath: path, currentName: name });
    setFolderName(name);
  };

  const handleDeleteFolder = (path: string) => {
    setDeleteConfirm({ path });
  };

  const handleDeleteFolderConfirm = async () => {
    if (deleteConfirm && onDeleteFolder) {
      await onDeleteFolder(deleteConfirm.path);
      setDeleteConfirm(null);
    }
  };

  const handleSubmitFolder = async () => {
    if (!folderModal || !folderName.trim()) return;

    setIsSubmitting(true);
    try {
      if (folderModal.mode === "create" && onCreateFolder) {
        const fullPath = folderModal.parentPath
          ? `${folderModal.parentPath}/${folderName.trim()}`
          : folderName.trim();
        await onCreateFolder(folderModal.parentPath, folderName.trim());
        // Expand the new folder
        setExpandedFolders((prev) => new Set([...prev, fullPath]));
      } else if (folderModal.mode === "rename" && onRenameFolder) {
        await onRenameFolder(folderModal.parentPath, folderName.trim());
      }
      setFolderModal(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Tree container with visual structure */}
      <div className="flex-1 min-h-0 flex flex-col border rounded-lg bg-muted/5 overflow-hidden">
        {/* Toolbar header */}
        <div className="shrink-0 flex items-center gap-1 px-2 py-1.5 border-b bg-muted/10">
          {/* Search input */}
          <div className="relative flex-1 max-w-[200px]">
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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action buttons */}
          {onCreateFolder && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => {
                // Create in selected folder if one is selected, otherwise at root
                if (selectedFolderPath) {
                  handleNewSubfolder(selectedFolderPath);
                } else {
                  handleNewRootFolder();
                }
              }}
            >
              <FolderPlus className="size-4" />
              <span className="text-xs">Folder</span>
            </Button>
          )}
          {onCreateDoc && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => onCreateDoc(selectedFolderPath || undefined)}
            >
              <FileText className="size-4" />
              <span className="text-xs">Doc</span>
            </Button>
          )}
        </div>

        {/* Tree content - scrollable with drag and drop */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <ScrollArea className="flex-1 min-h-0">
            {nodes.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No docs yet"
                  description="Create a doc or folder to get started"
                />
              </div>
            ) : filteredNodes.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No matches"
                  description={`No docs or folders match "${searchQuery}"`}
                />
              </div>
            ) : (
              <div className="py-2 px-1">
                {filteredNodes.map((node) => (
                  <ContentTreeItem
                    key={getNodeKey(node)}
                    node={node}
                    selectedDocId={selectedDocId}
                    selectedFolderPath={selectedFolderPath}
                    expandedFolders={expandedFolders}
                    onSelectDoc={onSelectDoc}
                    onSelectFolder={onSelectFolder}
                    onToggleFolder={toggleFolder}
                    onRenameFolder={onRenameFolder ? handleRenameFolder : undefined}
                    onDeleteFolder={onDeleteFolder ? handleDeleteFolder : undefined}
                    onNewSubfolder={onCreateFolder ? handleNewSubfolder : undefined}
                    onNewDocInFolder={onCreateDoc}
                    onDeleteDoc={onDeleteDoc}
                    onDeleteAsset={onDeleteAsset}
                    onToggleFolderAI={onToggleFolderAI}
                    folderAIStates={folderAIStates}
                    basePath={basePath}
                    isDraggable={!!onMoveDoc}
                    dropTargetPath={dropTargetPath}
                    allFolderPaths={allFolderPaths}
                    onMoveDocToFolder={onMoveDoc}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Drag overlay - shows item being dragged */}
          <DragOverlay>
            {activeDoc && (
              <div className="inline-flex items-center gap-1 py-1 px-2 rounded-md bg-accent shadow-lg">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm truncate max-w-[200px]">{activeDoc.title}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Folder create/rename modal */}
      <Dialog
        open={!!folderModal}
        onOpenChange={(open) => !open && setFolderModal(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {folderModal?.mode === "create" ? "New Folder" : "Rename Folder"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && folderName.trim()) {
                  handleSubmitFolder();
                }
              }}
              autoFocus
            />
            {folderModal?.mode === "create" && folderModal.parentPath && (
              <p className="text-sm text-muted-foreground mt-2">
                Creating in: {folderModal.parentPath}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFolder}
              disabled={!folderName.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : null}
              {folderModal?.mode === "create" ? "Create" : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder delete confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Delete Folder"
        description={`Delete "${deleteConfirm?.path.split("/").pop()}" and all its contents? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteFolderConfirm}
      />
    </div>
  );
}
