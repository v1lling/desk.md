"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { DocTree, DocEditor } from "@/components/docs";
import {
  useDocTree,
  useCreateDocFolder,
  useRenameDocFolder,
  useDeleteDocFolder,
  useCreateDocInFolder,
} from "@/stores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Folder } from "lucide-react";
import type { Doc } from "@/types";

export default function PersonalDocsPage() {
  const { data: tree = [], isLoading } = useDocTree("personal");

  // Folder mutations
  const createFolder = useCreateDocFolder();
  const renameFolder = useRenameDocFolder();
  const deleteFolder = useDeleteDocFolder();
  const createDocInFolder = useCreateDocInFolder();

  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocFolderPath, setNewDocFolderPath] = useState<string | undefined>();
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);

  // Count docs in tree
  const countDocs = (nodes: typeof tree): number => {
    let count = 0;
    for (const node of nodes) {
      if (node.type === "doc") count++;
      else if (node.type === "folder") count += countDocs(node.folder.children);
    }
    return count;
  };
  const docCount = countDocs(tree);

  const handleCreateDoc = async () => {
    if (!newDocTitle.trim()) return;

    const doc = await createDocInFolder.mutateAsync({
      scope: "personal",
      title: newDocTitle.trim(),
      folderPath: newDocFolderPath,
    });

    setNewDocTitle("");
    setNewDocFolderPath(undefined);
    setShowNewDoc(false);
    // Open the new doc for editing
    setSelectedDoc(doc);
  };

  const handleDocClick = (doc: Doc) => {
    setSelectedDoc(doc);
  };

  const handleCreateDocInFolder = useCallback((folderPath?: string) => {
    setNewDocFolderPath(folderPath);
    setShowNewDoc(true);
  }, []);

  // Folder operations
  const handleCreateFolder = useCallback(
    async (parentPath: string, name: string) => {
      const fullPath = parentPath ? `${parentPath}/${name}` : name;
      await createFolder.mutateAsync({
        scope: "personal",
        folderPath: fullPath,
      });
    },
    [createFolder]
  );

  const handleRenameFolder = useCallback(
    async (path: string, newName: string) => {
      await renameFolder.mutateAsync({
        scope: "personal",
        oldPath: path,
        newName,
      });
    },
    [renameFolder]
  );

  const handleDeleteFolder = useCallback(
    async (path: string) => {
      await deleteFolder.mutateAsync({
        scope: "personal",
        folderPath: path,
      });
    },
    [deleteFolder]
  );

  const handleDeleteDoc = useCallback((doc: Doc) => {
    // Open in editor where user can delete
    setSelectedDoc(doc);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Personal Docs"
        subtitle={`${docCount} doc${docCount !== 1 ? "s" : ""}`}
        action={{
          label: "New Doc",
          onClick: () => setShowNewDoc(true),
        }}
      />

      <main className="flex-1 overflow-hidden">
        <div className="flex h-full">
          {/* Tree sidebar */}
          <div className="w-64 border-r flex flex-col p-4">
            <DocTree
              nodes={tree}
              isLoading={isLoading}
              selectedDocId={selectedDoc?.id}
              onSelectDoc={handleDocClick}
              onCreateDoc={handleCreateDocInFolder}
              onDeleteDoc={handleDeleteDoc}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
            />
          </div>

          {/* Content area */}
          <div className="flex-1 p-6">
            {selectedDoc ? (
              <div className="h-full flex flex-col">
                <p className="text-sm text-muted-foreground mb-2">
                  Selected: {selectedDoc.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  Click the doc in the sidebar or use the editor panel to modify.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-muted-foreground">Select a doc to view</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Or create a new doc or folder using the tree
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New Doc Dialog */}
      <Dialog open={showNewDoc} onOpenChange={(open) => {
        if (!open) {
          setNewDocTitle("");
          setNewDocFolderPath(undefined);
        }
        setShowNewDoc(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Personal Doc</DialogTitle>
          </DialogHeader>
          {newDocFolderPath && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
              <Folder className="size-4" />
              <span>Creating in: {newDocFolderPath}</span>
            </div>
          )}
          <Input
            value={newDocTitle}
            onChange={(e) => setNewDocTitle(e.target.value)}
            placeholder="Doc title..."
            onKeyDown={(e) => e.key === "Enter" && handleCreateDoc()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowNewDoc(false);
              setNewDocTitle("");
              setNewDocFolderPath(undefined);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateDoc}
              disabled={!newDocTitle.trim() || createDocInFolder.isPending}
            >
              <Plus className="size-4 mr-2" />
              Create Doc
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Doc Editor */}
      <DocEditor
        doc={selectedDoc}
        open={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
      />
    </div>
  );
}
