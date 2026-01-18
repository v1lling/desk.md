"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Loader2, Trash2 } from "lucide-react";
import { useUpdateNote, useDeleteNote } from "@/stores";
import type { Note } from "@/types";
import { toast } from "sonner";

interface NoteEditorProps {
  note: Note | null;
  open: boolean;
  onClose: () => void;
}

export function NoteEditor({ note, open, onClose }: NoteEditorProps) {
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
    }
  }, [note]);

  const handleSave = async () => {
    if (!note) return;

    try {
      await updateNote.mutateAsync({
        noteId: note.id,
        areaId: note.areaId,
        projectId: note.projectId,
        updates: {
          title: title.trim() || note.title,
          content,
        },
      });
      toast.success("Note saved");
      onClose();
    } catch {
      toast.error("Failed to save note");
    }
  };

  const handleDelete = async () => {
    if (!note) return;

    if (confirm("Are you sure you want to delete this note?")) {
      try {
        await deleteNote.mutateAsync({ noteId: note.id, areaId: note.areaId, projectId: note.projectId });
        toast.success("Note deleted");
        onClose();
      } catch {
        toast.error("Failed to delete note");
      }
    }
  };

  const handleClose = () => {
    setTitle("");
    setContent("");
    onClose();
  };

  if (!note) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col px-0">
        <SheetHeader className="pb-4 border-b border-border/60 space-y-1 px-6">
          <SheetTitle className="sr-only">Edit Note</SheetTitle>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold tracking-tight border-none p-0 h-auto focus-visible:ring-0"
            placeholder="Note title"
          />
          <p className="text-xs text-muted-foreground">
            Created: {note.created}
          </p>
        </SheetHeader>

        <div className="flex-1 flex flex-col py-4 px-6 overflow-hidden">
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Write your note in markdown..."
            className="flex-1 overflow-hidden"
            minHeight="300px"
          />
        </div>

        <div className="flex justify-between pt-4 px-6 pb-6 border-t border-border/60">
          <Button
            variant="outline"
            size="icon"
            onClick={handleDelete}
            disabled={deleteNote.isPending}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {deleteNote.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateNote.isPending}>
              {updateNote.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
