"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { FolderPlus, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { DocTreeItem } from "./doc-tree-item";
import type { Doc, DocTreeNode, DocScope } from "@/types";

interface DocTreeProps {
  nodes: DocTreeNode[];
  isLoading?: boolean;
  selectedDocId?: string | null;
  onSelectDoc?: (doc: Doc) => void;
  onCreateDoc?: (folderPath?: string) => void;
  onDeleteDoc?: (doc: Doc) => void;
  onCreateFolder?: (parentPath: string, name: string) => Promise<void>;
  onRenameFolder?: (path: string, newName: string) => Promise<void>;
  onDeleteFolder?: (path: string) => Promise<void>;
  className?: string;
}

export function DocTree({
  nodes,
  isLoading,
  selectedDocId,
  onSelectDoc,
  onCreateDoc,
  onDeleteDoc,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  className,
}: DocTreeProps) {
  // Track expanded folders
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  // Modal state for creating/renaming folders
  const [folderModal, setFolderModal] = useState<{
    mode: "create" | "rename";
    parentPath: string; // For create, this is parent. For rename, this is the folder path.
    currentName?: string;
  } | null>(null);
  const [folderName, setFolderName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  }, []);

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

  const handleDeleteFolder = async (path: string) => {
    if (
      onDeleteFolder &&
      window.confirm(
        `Delete folder "${path.split("/").pop()}" and all its contents?`
      )
    ) {
      await onDeleteFolder(path);
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
      {/* Tree content */}
      <div className="flex-1 overflow-y-auto">
        {nodes.length === 0 ? (
          <EmptyState
            title="No docs yet"
            description="Create a doc or folder to get started"
          />
        ) : (
          <div className="py-2">
            {nodes.map((node) => (
              <DocTreeItem
                key={
                  node.type === "folder"
                    ? `folder-${node.folder.path}`
                    : `doc-${node.doc.id}`
                }
                node={node}
                selectedDocId={selectedDocId}
                expandedFolders={expandedFolders}
                onSelectDoc={onSelectDoc}
                onToggleFolder={toggleFolder}
                onRenameFolder={onRenameFolder ? handleRenameFolder : undefined}
                onDeleteFolder={onDeleteFolder ? handleDeleteFolder : undefined}
                onNewSubfolder={onCreateFolder ? handleNewSubfolder : undefined}
                onNewDocInFolder={onCreateDoc}
                onDeleteDoc={onDeleteDoc}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="shrink-0 border-t pt-2 mt-2 flex items-center gap-2">
        {onCreateFolder && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleNewRootFolder}
          >
            <FolderPlus className="size-4 mr-1" />
            Folder
          </Button>
        )}
        {onCreateDoc && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onCreateDoc()}
          >
            <FileText className="size-4 mr-1" />
            Doc
          </Button>
        )}
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
    </div>
  );
}
