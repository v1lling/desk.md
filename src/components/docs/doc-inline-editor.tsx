"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SaveStatusIndicator } from "@/components/ui/save-status";
import { Trash2, Folder, ChevronRight, Maximize2, Minimize2, X } from "lucide-react";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";
import { useDocForm } from "./use-doc-form";
import { cn } from "@/lib/utils";
import type { Doc } from "@/types";

interface DocInlineEditorProps {
  doc: Doc | null;
  onClose?: () => void;
  className?: string;
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
 * DocInlineEditor - Doc editor for inline display in docs views
 *
 * Use this when editing docs within a docs view (Personal Docs, Workspace Docs, Project Docs).
 * Renders inline in the content area instead of a slide-in panel.
 * Supports fullscreen mode for focused editing.
 */
export function DocInlineEditor({ doc, onClose, className }: DocInlineEditorProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mainElement, setMainElement] = useState<HTMLElement | null>(null);

  const form = useDocForm(doc, {
    enabled: !!doc,
    onDeleted: onClose,
    onClose,
  });

  // Find main element for fullscreen portal
  useEffect(() => {
    const main = document.querySelector("main");
    setMainElement(main as HTMLElement);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + Shift + F for fullscreen
  useEffect(() => {
    if (!doc) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [doc]);

  // Handle escape in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  if (!doc) {
    return (
      <div className={cn("h-full bg-muted/5", className)} />
    );
  }

  // Header with title input and actions
  const header = (
    <header className="flex items-center justify-between border-b border-border/60 px-6 py-4 shrink-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Input
          value={form.title}
          onChange={(e) => form.setTitle(e.target.value)}
          placeholder="Doc title"
          className="text-lg font-semibold border-none shadow-none px-0 h-auto py-0 focus-visible:ring-0 bg-transparent"
        />
        {form.saveStatus && <SaveStatusIndicator status={form.saveStatus} compact />}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => form.setShowDeleteConfirm(true)}
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleFullscreen}
          className="h-8 w-8"
          title="Expand (Cmd+Shift+F)"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={form.handleClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );

  // Main editor content
  const editorContent = (
    <div className="space-y-4">
      {doc.path && <FolderBreadcrumb path={doc.path} />}

      <MetadataToolbar
        projectId={form.projectId}
        onProjectChange={form.setProjectId}
        projects={form.projects}
      />

      <div className="min-h-[300px]">
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
    </div>
  );

  // Footer (only when project changed)
  const footer = form.projectChanged ? (
    <div className="border-t border-border/60 px-6 py-4 shrink-0">
      <div className="flex justify-end">
        <Button onClick={form.handleSave} className="min-w-[140px]">
          Move & Save
        </Button>
      </div>
    </div>
  ) : null;

  // Inline view
  const inlineView = (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {header}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-6 py-6">{editorContent}</div>
      </ScrollArea>
      {footer}
    </div>
  );

  // Fullscreen view (portal to main)
  const fullscreenView = mainElement
    ? createPortal(
        <>
          {/* Backdrop */}
          <div
            className="absolute inset-0 z-40 bg-black/50"
            onClick={() => setIsFullscreen(false)}
          />

          {/* Fullscreen container */}
          <div className="absolute inset-0 z-50 bg-background flex flex-col">
            {/* Fullscreen header */}
            <header className="flex items-center justify-between border-b border-border/60 px-6 py-3 shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Input
                  value={form.title}
                  onChange={(e) => form.setTitle(e.target.value)}
                  placeholder="Doc title"
                  className="text-lg font-semibold border-none shadow-none px-0 h-auto py-0 focus-visible:ring-0 bg-transparent"
                />
                {form.saveStatus && <SaveStatusIndicator status={form.saveStatus} compact />}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => form.setShowDeleteConfirm(true)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleFullscreen}
                  className="h-8 w-8"
                  title="Collapse (Cmd+Shift+F)"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>
            </header>

            {/* Fullscreen content */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 py-4">
                <div className="flex flex-col h-full space-y-3">
                  {doc.path && <FolderBreadcrumb path={doc.path} />}

                  <MetadataToolbar
                    projectId={form.projectId}
                    onProjectChange={form.setProjectId}
                    projects={form.projects}
                  />

                  <div className="flex-1 min-h-[400px]">
                    {form.isEditorReady ? (
                      <RichTextEditor
                        value={form.content}
                        onChange={form.setContent}
                        placeholder="Write your doc in markdown..."
                        minHeight="400px"
                      />
                    ) : (
                      <div className="h-[400px] border rounded-lg flex items-center justify-center bg-muted/10">
                        <LoadingState label="file" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Fullscreen footer */}
            <div className="border-t border-border/60 px-6 py-3 shrink-0">
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
            </div>
          </div>
        </>,
        mainElement
      )
    : null;

  return (
    <>
      {inlineView}
      {isFullscreen && fullscreenView}

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
