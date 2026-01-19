"use client";

import { useState } from "react";
import { Header } from "@/components/layout";
import { NoteList } from "@/components/notes";
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
import type { Note } from "@/types";
import { MarkdownEditor } from "@/components/ui/markdown-editor";

export default function PersonalNotesPage() {
  const { data: notes = [], isLoading } = usePersonalNotes();
  const createNote = useCreatePersonalNote();
  const updateNote = useUpdatePersonalNote();
  const deleteNote = useDeletePersonalNote();

  const [showNewNote, setShowNewNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [editorContent, setEditorContent] = useState("");

  const handleCreateNote = async () => {
    if (!newNoteTitle.trim()) return;
    const note = await createNote.mutateAsync({ title: newNoteTitle.trim() });
    setNewNoteTitle("");
    setShowNewNote(false);
    // Open the new note for editing
    setSelectedNote(note);
    setEditorContent(note.content);
  };

  const handleNoteClick = (note: Note) => {
    setSelectedNote(note);
    setEditorContent(note.content);
  };

  const handleSave = async () => {
    if (!selectedNote) return;
    await updateNote.mutateAsync({
      noteId: selectedNote.id,
      updates: { content: editorContent },
    });
  };

  const handleDelete = async () => {
    if (!selectedNote) return;
    await deleteNote.mutateAsync(selectedNote.id);
    setSelectedNote(null);
  };

  const handleCloseEditor = () => {
    // Auto-save before closing
    if (selectedNote && editorContent !== selectedNote.content) {
      handleSave();
    }
    setSelectedNote(null);
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Personal Notes"
        subtitle={`${notes.length} note${notes.length !== 1 ? "s" : ""}`}
        action={{
          label: "New Note",
          onClick: () => setShowNewNote(true),
        }}
      />

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-muted-foreground">
              Loading notes...
            </div>
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No notes yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first personal note to get started
            </p>
          </div>
        ) : (
          <NoteList notes={notes} onNoteClick={handleNoteClick} />
        )}
      </main>

      {/* New Note Dialog */}
      <Dialog open={showNewNote} onOpenChange={setShowNewNote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Personal Note</DialogTitle>
          </DialogHeader>
          <Input
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            placeholder="Note title..."
            onKeyDown={(e) => e.key === "Enter" && handleCreateNote()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewNote(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNote} disabled={!newNoteTitle.trim()}>
              <Plus className="size-4 mr-2" />
              Create Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note Editor Sheet */}
      <Sheet open={!!selectedNote} onOpenChange={(open) => !open && handleCloseEditor()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-semibold">
                {selectedNote?.title}
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
            {selectedNote && (
              <MarkdownEditor
                value={editorContent}
                onChange={setEditorContent}
                placeholder="Write your note in markdown..."
                minHeight="400px"
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
