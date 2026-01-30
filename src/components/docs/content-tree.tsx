"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { FolderPlus, FileText, Loader2 } from "lucide-react";
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
import { getNodeKey } from "@/lib/orbit/content";

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
}: ContentTreeProps) {
  // Track expanded folders - use controlled state if provided, otherwise local state
  const [localExpandedFolders, setLocalExpandedFolders] = useState<Set<string>>(
    new Set()
  );

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
        {(onCreateFolder || onCreateDoc) && (
          <div className="shrink-0 flex items-center gap-1 px-2 py-1.5 border-b bg-muted/10">
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
        )}

        {/* Tree content - scrollable */}
        <ScrollArea className="flex-1 min-h-0">
          {nodes.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No docs yet"
                description="Create a doc or folder to get started"
              />
            </div>
          ) : (
            <div className="py-2 px-1">
              {nodes.map((node) => (
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
                />
              ))}
            </div>
          )}
        </ScrollArea>
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
