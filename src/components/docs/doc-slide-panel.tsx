"use client";

import { SlidePanel } from "@/components/ui/slide-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Trash2, Folder, ChevronRight } from "lucide-react";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";
import { useDocForm } from "./use-doc-form";
import type { Doc } from "@/types";

interface DocSlidePanelProps {
  doc: Doc | null;
  open: boolean;
  onClose: () => void;
}

// Helper to render folder path breadcrumb
function FolderBreadcrumb({ path }: { path?: string }) {
  if (!path) return null;

  const parts = path.split("/");
  if (parts.length <= 1) return null;

  const folderParts = parts.slice(0, -1);

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

/**
 * DocSlidePanel - Doc editor in a slide-in panel
 *
 * Use this when opening docs from:
 * - Global search results
 * - "All Projects" card grid
 * - Any context outside of a dedicated docs view
 */
export function DocSlidePanel({ doc, open, onClose }: DocSlidePanelProps) {
  const form = useDocForm(doc, {
    enabled: open,
    onDeleted: onClose,
    onClose,
  });

  if (!doc) return null;

  // Panel form content
  const formContent = (
    <div className="space-y-4">
      {doc.path && <FolderBreadcrumb path={doc.path} />}

      <Input
        value={form.title}
        onChange={(e) => form.setTitle(e.target.value)}
        placeholder="Doc title"
        className="text-base font-medium"
      />

      <MetadataToolbar
        projectId={form.projectId}
        onProjectChange={form.setProjectId}
        projects={form.projects}
      />

      <div className="space-y-2">
        <Label>Content</Label>
        {form.isEditorReady ? (
          <RichTextEditor
            value={form.content}
            onChange={form.setContent}
            placeholder="Write your doc in markdown..."
            minHeight="300px"
          />
        ) : (
          <div className="h-[300px] border rounded-lg flex items-center justify-center bg-muted/10">
            <LoadingState label="file" />
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/40">
        <p className="truncate font-mono" title={doc.filePath}>
          {doc.filePath}
        </p>
        <p className="mt-1.5">Created: {doc.created}</p>
      </div>
    </div>
  );

  // Fullscreen content
  const fullscreenContent = (
    <div className="flex flex-col h-full space-y-3">
      {doc.path && <FolderBreadcrumb path={doc.path} />}

      <MetadataToolbar
        projectId={form.projectId}
        onProjectChange={form.setProjectId}
        projects={form.projects}
      />

      <div className="flex-1 min-h-0">
        {form.isEditorReady ? (
          <RichTextEditor
            value={form.content}
            onChange={form.setContent}
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
    </div>
  );

  // Header delete button
  const deleteButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => form.setShowDeleteConfirm(true)}
      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );

  // Footer (only when project changed)
  const footer = form.projectChanged ? (
    <div className="flex justify-end">
      <Button onClick={form.handleSave} className="min-w-[140px]">
        Move & Save
      </Button>
    </div>
  ) : null;

  // Fullscreen title input
  const fullscreenTitleInput = (
    <Input
      value={form.title}
      onChange={(e) => form.setTitle(e.target.value)}
      placeholder="Doc title"
      className="text-lg font-semibold border-none shadow-none px-0 h-auto py-0 focus-visible:ring-0 bg-transparent flex-1"
    />
  );

  // Fullscreen footer
  const fullscreenFooter = (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">
        Cmd+Shift+F to exit
      </span>
      {form.projectChanged && (
        <Button onClick={form.handleSave} className="min-w-[140px]">
          Move & Save
        </Button>
      )}
    </div>
  );

  return (
    <>
      <SlidePanel
        open={open}
        onClose={form.handleClose}
        title="Edit Doc"
        footer={footer}
        fullscreenChildren={fullscreenContent}
        fullscreenFooter={fullscreenFooter}
        fullscreenTitleInput={fullscreenTitleInput}
        headerActions={deleteButton}
        saveStatus={form.saveStatus}
      >
        {formContent}
      </SlidePanel>

      <ConfirmDialog
        open={form.showDeleteConfirm}
        onOpenChange={form.setShowDeleteConfirm}
        title="Delete Doc"
        description="Are you sure you want to delete this doc? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={form.handleDeleteConfirm}
      />
    </>
  );
}
