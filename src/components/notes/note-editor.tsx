"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Trash2, FolderKanban } from "lucide-react";
import { useUpdateNote, useDeleteNote, useMoveNoteToProject, useProjects } from "@/stores";
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
  const moveNoteToProject = useMoveNoteToProject();
  const { data: projects = [] } = useProjects(note?.areaId || null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState("");

  // Project options for dropdown
  const projectOptions = useMemo(
    () => [
      { value: "_unassigned", label: "No project" },
      ...projects.map((p) => ({ value: p.id, label: p.name })),
    ],
    [projects]
  );

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setProjectId(note.projectId);
    }
  }, [note]);

  const handleSave = async () => {
    if (!note) return;

    try {
      // If project changed, move the file first
      if (projectId !== note.projectId) {
        await moveNoteToProject.mutateAsync({
          noteId: note.id,
          areaId: note.areaId,
          fromProjectId: note.projectId,
          toProjectId: projectId,
        });
      }

      await updateNote.mutateAsync({
        noteId: note.id,
        areaId: note.areaId,
        projectId: projectId,
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

  if (!note) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col px-0">
        <SheetHeader className="pb-4 border-b border-border/60">
          <SheetTitle>Edit Note</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6 px-6 space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title"
            />
          </div>

          {/* Project */}
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                {projectOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <FolderKanban className="h-3 w-3 text-muted-foreground" />
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label>Content</Label>
            <MarkdownEditor
              value={content}
              onChange={setContent}
              placeholder="Write your note in markdown..."
              minHeight="300px"
            />
          </div>

          {/* File path (read-only info) */}
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/40">
            <p className="truncate font-mono" title={note.filePath}>
              {note.filePath}
            </p>
            <p className="mt-1.5">Created: {note.created}</p>
          </div>
        </div>

        {/* Actions - fixed at bottom */}
        <div className="flex gap-2 pt-4 px-6 pb-6 border-t border-border/60">
          <Button onClick={handleSave} className="flex-1">
            Save Changes
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
