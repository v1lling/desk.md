"use client";

import { useState, useEffect } from "react";
import { EditorShell } from "@/components/ui/editor-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Trash2 } from "lucide-react";
import { useUpdateNote, useDeleteNote, useMoveNoteToProject, useProjects } from "@/stores";
import type { Note } from "@/types";
import { toast } from "sonner";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!note) return;

    try {
      await deleteNote.mutateAsync({ noteId: note.id, areaId: note.areaId, projectId: note.projectId });
      toast.success("Note deleted");
      onClose();
    } catch {
      toast.error("Failed to delete note");
    }
  };

  if (!note) return null;

  const formContent = (
    <div className="space-y-4">
      {/* Title */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
        className="text-base font-medium"
      />

      {/* Metadata toolbar - same component as fullscreen for consistency */}
      <MetadataToolbar
        projectId={projectId}
        onProjectChange={setProjectId}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />

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
  );

  const footer = (
    <div className="flex gap-2 justify-end">
      <Button onClick={handleSave} className="min-w-[140px]">
        Save Changes
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleDeleteClick}
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  // Fullscreen-specific content: maximized editor with compact project selector
  const fullscreenContent = (
    <div className="flex flex-col h-full space-y-3">
      {/* Large title input - borderless for focus mode */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
        className="text-xl font-semibold border-none shadow-none px-0 h-auto py-1 focus-visible:ring-0 bg-transparent"
      />

      {/* Compact metadata toolbar - just project for notes */}
      <MetadataToolbar
        projectId={projectId}
        onProjectChange={setProjectId}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />

      {/* Maximized editor - fills remaining space */}
      <div className="flex-1 min-h-0">
        <MarkdownEditor
          value={content}
          onChange={setContent}
          placeholder="Write your note in markdown..."
          minHeight="100%"
          className="h-full [&>div]:h-full [&>div>div]:h-full"
        />
      </div>

      {/* NO file path info in fullscreen */}
    </div>
  );

  // Fullscreen-specific footer with hint
  const fullscreenFooter = (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">
        Press Cmd+Shift+F to exit fullscreen
      </span>
      <div className="flex gap-2">
        <Button onClick={handleSave} className="min-w-[140px]">
          Save Changes
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleDeleteClick}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <EditorShell
        open={open}
        onClose={onClose}
        title="Edit Note"
        footer={footer}
        fullscreenChildren={fullscreenContent}
        fullscreenFooter={fullscreenFooter}
      >
        {formContent}
      </EditorShell>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
