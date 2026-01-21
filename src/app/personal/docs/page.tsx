"use client";

import { useState } from "react";
import { Header } from "@/components/layout";
import { DocList } from "@/components/docs";
import {
  usePersonalNotes,
  usePersonalNote,
  useCreatePersonalNote,
  useUpdatePersonalNote,
  useDeletePersonalNote,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Plus, Trash2 } from "lucide-react";
import type { Doc } from "@/types";
import { MarkdownEditor } from "@/components/ui/markdown-editor";

export default function PersonalDocsPage() {
  const { data: docs = [], isLoading } = usePersonalNotes();
  const createDoc = useCreatePersonalNote();
  const updateDoc = useUpdatePersonalNote();
  const deleteDoc = useDeletePersonalNote();

  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [editorContent, setEditorContent] = useState("");

  const handleCreateDoc = async () => {
    if (!newDocTitle.trim()) return;
    const doc = await createDoc.mutateAsync({ title: newDocTitle.trim() });
    setNewDocTitle("");
    setShowNewDoc(false);
    // Open the new doc for editing
    setSelectedDoc(doc);
    setEditorContent(doc.content);
  };

  const handleDocClick = (doc: Doc) => {
    setSelectedDoc(doc);
    setEditorContent(doc.content);
  };

  const handleSave = async () => {
    if (!selectedDoc) return;
    await updateDoc.mutateAsync({
      noteId: selectedDoc.id,
      updates: { content: editorContent },
    });
  };

  const handleDelete = async () => {
    if (!selectedDoc) return;
    await deleteDoc.mutateAsync(selectedDoc.id);
    setSelectedDoc(null);
  };

  const handleCloseEditor = () => {
    // Auto-save before closing
    if (selectedDoc && editorContent !== selectedDoc.content) {
      handleSave();
    }
    setSelectedDoc(null);
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Personal Docs"
        subtitle={`${docs.length} doc${docs.length !== 1 ? "s" : ""}`}
        action={{
          label: "New Doc",
          onClick: () => setShowNewDoc(true),
        }}
      />

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-muted-foreground">
              Loading docs...
            </div>
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No docs yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first personal doc to get started
            </p>
          </div>
        ) : (
          <DocList docs={docs} onDocClick={handleDocClick} />
        )}
      </main>

      {/* New Doc Dialog */}
      <Dialog open={showNewDoc} onOpenChange={setShowNewDoc}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Personal Doc</DialogTitle>
          </DialogHeader>
          <Input
            value={newDocTitle}
            onChange={(e) => setNewDocTitle(e.target.value)}
            placeholder="Doc title..."
            onKeyDown={(e) => e.key === "Enter" && handleCreateDoc()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDoc(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDoc} disabled={!newDocTitle.trim()}>
              <Plus className="size-4 mr-2" />
              Create Doc
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Doc Editor Sheet */}
      <Sheet open={!!selectedDoc} onOpenChange={(open) => !open && handleCloseEditor()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-semibold">
                {selectedDoc?.title}
              </SheetTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-auto p-6">
            {selectedDoc && (
              <MarkdownEditor
                value={editorContent}
                onChange={setEditorContent}
                placeholder="Write your doc in markdown..."
                minHeight="400px"
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
