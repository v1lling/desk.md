"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { EditorShell } from "@/components/ui/editor-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Trash2 } from "lucide-react";
import { useUpdateNote, useDeleteNote, useMoveNoteToProject, useProjects } from "@/stores";
import { useAutoSave } from "@/hooks/use-auto-save";
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
  const { data: projects = [] } = useProjects(note?.workspaceId || null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Track original projectId to detect moves (moves need special handling)
  const [originalProjectId, setOriginalProjectId] = useState("");

  // Sync state when note changes
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setProjectId(note.projectId);
      setOriginalProjectId(note.projectId);
    }
  }, [note]);

  // Auto-save data (excluding project changes which need file move)
  const autoSaveData = useMemo(
    () => ({ title, content }),
    [title, content]
  );

  // Auto-save handler
  const handleAutoSave = useCallback(
    async (data: { title: string; content: string }) => {
      if (!note) return;

      await updateNote.mutateAsync({
        noteId: note.id,
        workspaceId: note.workspaceId,
        projectId: note.projectId,
        updates: {
          title: data.title.trim() || note.title,
          content: data.content,
        },
      });
    },
    [note, updateNote]
  );

  // Auto-save hook - only enabled when editor is open
  const { status: saveStatus, save: triggerSave, isDirty } = useAutoSave({
    data: autoSaveData,
    onSave: handleAutoSave,
    enabled: open && !!note,
  });

  // Manual save (for project changes or explicit save)
  const handleSave = async () => {
    if (!note) return;

    try {
      // If project changed, move the file first
      if (projectId !== originalProjectId) {
        await moveNoteToProject.mutateAsync({
          noteId: note.id,
          workspaceId: note.workspaceId,
          fromProjectId: originalProjectId,
          toProjectId: projectId,
        });
        setOriginalProjectId(projectId);
      }

      // Save content changes
      await triggerSave();
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
      await deleteNote.mutateAsync({ noteId: note.id, workspaceId: note.workspaceId, projectId: note.projectId });
      toast.success("Note deleted");
      onClose();
    } catch {
      toast.error("Failed to delete note");
    }
  };

  // Handle close - save pending changes if dirty
  const handleClose = async () => {
    if (isDirty) {
      await triggerSave();
    }
    onClose();
  };

  if (!note) return null;

  // Check if project was changed (requires explicit save)
  const projectChanged = projectId !== originalProjectId;

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

  // Delete button for header
  const deleteButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDeleteClick}
      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );

  // Footer only shown when project changed (needs "Move & Save" button)
  const footer = projectChanged ? (
    <div className="flex justify-end">
      <Button onClick={handleSave} className="min-w-[140px]">
        Move & Save
      </Button>
    </div>
  ) : null;

  // Editable title for fullscreen header
  const fullscreenTitleInput = (
    <Input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      placeholder="Note title"
      className="text-lg font-semibold border-none shadow-none px-0 h-auto py-0 focus-visible:ring-0 bg-transparent flex-1"
    />
  );

  // Fullscreen-specific content: maximized editor with compact project selector
  const fullscreenContent = (
    <div className="flex flex-col h-full space-y-3">
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

  // Fullscreen footer - keyboard hint, and "Move & Save" if needed
  const fullscreenFooter = (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">
        Cmd+Shift+F to exit
      </span>
      {projectChanged && (
        <Button onClick={handleSave} className="min-w-[140px]">
          Move & Save
        </Button>
      )}
    </div>
  );

  return (
    <>
      <EditorShell
        open={open}
        onClose={handleClose}
        title="Edit Note"
        footer={footer}
        fullscreenChildren={fullscreenContent}
        fullscreenFooter={fullscreenFooter}
        fullscreenTitleInput={fullscreenTitleInput}
        headerActions={deleteButton}
        saveStatus={saveStatus}
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
