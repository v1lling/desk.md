"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { EditorShell } from "@/components/ui/editor-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Trash2, Folder, ChevronRight } from "lucide-react";
import { useUpdateDoc, useDeleteDoc, useMoveDocToProject, useProjects } from "@/stores";
import { useAutoSave } from "@/hooks/use-auto-save";
import type { Doc } from "@/types";
import { toast } from "sonner";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";

interface DocEditorProps {
  doc: Doc | null;
  open: boolean;
  onClose: () => void;
}

// Helper to render folder path breadcrumb
function FolderBreadcrumb({ path }: { path?: string }) {
  if (!path) return null;

  // Extract folder path (everything before the filename)
  const parts = path.split("/");
  if (parts.length <= 1) return null; // No folder, just a filename

  const folderParts = parts.slice(0, -1); // Remove filename

  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <Folder className="size-3.5" />
      {folderParts.map((part, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="size-3" />}
          <span>{part}</span>
        </span>
      ))}
    </div>
  );
}

export function DocEditor({ doc, open, onClose }: DocEditorProps) {
  const updateDoc = useUpdateDoc();
  const deleteDoc = useDeleteDoc();
  const moveDocToProject = useMoveDocToProject();
  const { data: projects = [] } = useProjects(doc?.workspaceId || null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Track if editor is ready to render (deferred to avoid blocking open animation)
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Track original projectId to detect moves (moves need special handling)
  const [originalProjectId, setOriginalProjectId] = useState("");

  // Sync state when doc changes
  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setContent(doc.content);
      setProjectId(doc.projectId);
      setOriginalProjectId(doc.projectId);
      // Reset ready state when doc changes (or on first open)
      setIsEditorReady(false);
    }
  }, [doc]);

  // Defer editor rendering to allow panel animation to start smoothly
  useEffect(() => {
    if (open && doc && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [open, doc, isEditorReady]);

  // Auto-save data (excluding project changes which need file move)
  const autoSaveData = useMemo(
    () => ({ title, content }),
    [title, content]
  );

  // Auto-save handler
  const handleAutoSave = useCallback(
    async (data: { title: string; content: string }) => {
      if (!doc) return;

      await updateDoc.mutateAsync({
        doc,
        updates: {
          title: data.title.trim() || doc.title,
          content: data.content,
        },
      });
    },
    [doc, updateDoc]
  );

  // Auto-save hook - only enabled when editor is open
  const { status: saveStatus, save: triggerSave, isDirty } = useAutoSave({
    data: autoSaveData,
    onSave: handleAutoSave,
    enabled: open && !!doc,
  });

  // Manual save (for project changes or explicit save)
  const handleSave = async () => {
    if (!doc) return;

    try {
      // If project changed, move the file first
      if (projectId !== originalProjectId) {
        await moveDocToProject.mutateAsync({
          docId: doc.id,
          workspaceId: doc.workspaceId,
          fromProjectId: originalProjectId,
          toProjectId: projectId,
        });
        setOriginalProjectId(projectId);
      }

      // Save content changes
      await triggerSave();
      toast.success("Doc saved");
      onClose();
    } catch {
      toast.error("Failed to save doc");
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!doc) return;

    try {
      await deleteDoc.mutateAsync(doc);
      toast.success("Doc deleted");
      onClose();
    } catch {
      toast.error("Failed to delete doc");
    }
  };

  // Handle close - save pending changes if dirty
  const handleClose = async () => {
    if (isDirty) {
      await triggerSave();
    }
    onClose();
  };

  if (!doc) return null;

  // Check if project was changed (requires explicit save)
  const projectChanged = projectId !== originalProjectId;

  const formContent = (
    <div className="space-y-4">
      {/* Folder path breadcrumb */}
      {doc.path && <FolderBreadcrumb path={doc.path} />}

      {/* Title */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Doc title"
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
        {isEditorReady ? (
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Write your doc in markdown..."
            minHeight="300px"
          />
        ) : (
          <div className="h-[300px] border rounded-lg flex items-center justify-center bg-muted/10">
            <LoadingState label="file" />
          </div>
        )}
      </div>

      {/* File path (read-only info) */}
      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/40">
        <p className="truncate font-mono" title={doc.filePath}>
          {doc.filePath}
        </p>
        <p className="mt-1.5">Created: {doc.created}</p>
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
      placeholder="Doc title"
      className="text-lg font-semibold border-none shadow-none px-0 h-auto py-0 focus-visible:ring-0 bg-transparent flex-1"
    />
  );

  // Fullscreen-specific content: maximized editor with compact project selector
  const fullscreenContent = (
    <div className="flex flex-col h-full space-y-3">
      {/* Folder path breadcrumb */}
      {doc.path && <FolderBreadcrumb path={doc.path} />}

      {/* Compact metadata toolbar - just project for docs */}
      <MetadataToolbar
        projectId={projectId}
        onProjectChange={setProjectId}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />

      {/* Maximized editor - fills remaining space */}
      <div className="flex-1 min-h-0">
        {isEditorReady ? (
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Write your doc in markdown..."
            minHeight="100%"
            className="h-full [&>div]:h-full [&>div>div]:h-full"
          />
        ) : (
          <div className="h-full border rounded-lg flex items-center justify-center bg-muted/10">
            <LoadingState label="file" />
          </div>
        )}
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
        title="Edit Doc"
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
        title="Delete Doc"
        description="Are you sure you want to delete this doc? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
