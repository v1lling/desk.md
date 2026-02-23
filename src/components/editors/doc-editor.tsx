"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDoc, useUpdateDoc, useDeleteDoc, useMoveDocToProject, useProjects, useTabStore } from "@/stores";
import { indexDocumentOnSave, removeFromIndex } from "@/hooks/use-rag-indexer";
import { useEditorSession } from "@/hooks/use-editor-session";
import { useEditorTab, useInternalLinkHandler } from "@/hooks";
import { getAiExclusionState, setAIInclusion } from "@/lib/rag/aiignore";
import type { AiExclusionState } from "@/lib/rag/aiignore";
import { EditorHeader } from "./editor-header";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileMovedBanner, FileDeletedBanner } from "@/components/ui/editor-banners";
import { Folder, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface DocEditorProps {
  docId: string;
  workspaceId: string;
  projectId?: string;
  onClose: () => void;
}

function FolderBreadcrumb({ path }: { path?: string }) {
  if (!path) return null;

  const parts = path.split("/");
  if (parts.length <= 1) return null;

  const folderParts = parts.slice(0, -1);

  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
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

export function DocEditor({ docId, workspaceId, onClose }: DocEditorProps) {
  const handleInternalLinkClick = useInternalLinkHandler();

  // Load doc metadata via TanStack Query
  const { data: doc, isLoading: isLoadingDoc } = useDoc(workspaceId, docId);
  const { data: projects = [] } = useProjects(workspaceId);

  // Mutations
  const updateDoc = useUpdateDoc();
  const deleteDoc = useDeleteDoc();
  const moveDocToProject = useMoveDocToProject();

  // Local state for title and project
  const [title, setTitle] = useState("");
  const [currentProjectId, setCurrentProjectId] = useState("");
  const [originalProjectId, setOriginalProjectId] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [aiExclusionState, setAiExclusionState] = useState<AiExclusionState>({
    isExcluded: false,
    isInExcludedFolder: false,
  });

  // Initialize local state from doc
  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setCurrentProjectId(doc.projectId);
      setOriginalProjectId(doc.projectId);
      setIsEditorReady(false);
      getAiExclusionState(doc.filePath, workspaceId).then(setAiExclusionState);
    }
  }, [doc?.id, workspaceId]);

  const handleSaveComplete = useCallback(
    (path: string, content: string) => {
      if (!doc) return;
      indexDocumentOnSave({
        path,
        content,
        workspaceId,
        contentType: "doc",
        title: title || doc.title,
      });
    },
    [doc, workspaceId, title]
  );

  const {
    content,
    setContent,
    getCurrentContent,
    isLoading: isLoadingContent,
    isDirty: contentDirty,
    saveStatus,
    pathChanged,
    newPath,
    fileDeleted,
    acknowledgePathChange,
    acknowledgeDeleted,
    save,
  } = useEditorSession({
    type: "doc",
    entityId: docId,
    filePath: doc?.filePath,
    initialContent: "",
    enabled: !!doc,
    onSaveComplete: handleSaveComplete,
  });

  // Defer editor rendering for smooth tab switches
  useEffect(() => {
    if (doc && !isLoadingContent && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [doc, isLoadingContent, isEditorReady]);

  // Track title changes (saved immediately with content)
  const [titleDirty, setTitleDirty] = useState(false);

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      setTitle(newTitle);
      setTitleDirty(true);
      // Save title immediately with current body content
      if (doc) {
        try {
          await updateDoc.mutateAsync({
            doc,
            updates: { title: newTitle.trim() || doc.title, content: getCurrentContent() },
          });
          setTitleDirty(false);
        } catch (error) {
          console.error("[doc-editor] Failed to save title:", error);
        }
      }
    },
    [doc, updateDoc, getCurrentContent]
  );

  // Manage tab title and dirty state
  const isDirty = contentDirty || titleDirty;
  useEditorTab(`doc-${docId}`, title, isDirty);

  // Keyboard shortcut: Cmd+S to save (also handles menu-save event from Tauri native menu)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Also listen for menu save event from Tauri native menu
    let unlistenMenu: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("menu-save", () => {
        save();
      }).then((unlisten) => {
        unlistenMenu = unlisten;
      });
    }).catch(() => {
      // Not in Tauri environment
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unlistenMenu?.();
    };
  }, [save]);

  // Handle save-and-close request from tab bar
  const pendingSaveAndClose = useTabStore((state) => state.pendingSaveAndClose);
  const clearPendingSaveAndClose = useTabStore((state) => state.clearPendingSaveAndClose);
  const closeTab = useTabStore((state) => state.closeTab);

  useEffect(() => {
    if (pendingSaveAndClose === `doc-${docId}`) {
      (async () => {
        await save();
        clearPendingSaveAndClose();
        closeTab(`doc-${docId}`);
      })();
    }
  }, [pendingSaveAndClose, docId, save, clearPendingSaveAndClose, closeTab]);

  // Check if project was changed
  const projectChanged = currentProjectId !== originalProjectId;

  // Handle project move & save
  const handleProjectMove = useCallback(async () => {
    if (!doc) return;

    try {
      if (projectChanged) {
        await moveDocToProject.mutateAsync({
          docId: doc.id,
          workspaceId: doc.workspaceId,
          fromProjectId: originalProjectId,
          toProjectId: currentProjectId,
        });
        setOriginalProjectId(currentProjectId);
      }

      await save();
      toast.success("Doc saved");
      onClose();
    } catch {
      toast.error("Failed to save doc");
    }
  }, [doc, projectChanged, moveDocToProject, originalProjectId, currentProjectId, save, onClose]);

  // Handle delete
  const handleDeleteConfirm = useCallback(async () => {
    if (!doc) return;

    try {
      await deleteDoc.mutateAsync(doc);
      toast.success("Doc deleted");
      setShowDeleteConfirm(false);
      onClose();
    } catch {
      toast.error("Failed to delete doc");
    }
  }, [doc, deleteDoc, onClose]);

  // Map save status for the header
  const headerSaveStatus = useMemo(() => {
    if (saveStatus === "saving") return "saving" as const;
    if (saveStatus === "error") return "error" as const;
    return "idle" as const;
  }, [saveStatus]);

  // Handle AI inclusion toggle
  const handleAIInclusionChange = useCallback(
    async (included: boolean) => {
      if (!doc) return;
      if (aiExclusionState.isInExcludedFolder) return;
      try {
        await setAIInclusion(doc.filePath, workspaceId, included);
        setAiExclusionState((prev) => ({ ...prev, isExcluded: !included }));
        if (!included) {
          await removeFromIndex(doc.filePath);
        }
      } catch (error) {
        console.error("[doc-editor] Failed to update AI inclusion:", error);
        toast.error("Failed to update AI setting");
      }
    },
    [doc, workspaceId, aiExclusionState.isInExcludedFolder]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Render states
  // ═══════════════════════════════════════════════════════════════════════════

  if (fileDeleted) {
    return (
      <FileDeletedBanner
        onClose={() => {
          acknowledgeDeleted();
          onClose();
        }}
      />
    );
  }

  if (pathChanged && newPath) {
    return (
      <FileMovedBanner
        newPath={newPath}
        onAcknowledge={acknowledgePathChange}
      />
    );
  }

  if (isLoadingDoc) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <LoadingState label="doc" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <p>Doc not found</p>
          <Button variant="ghost" onClick={onClose} className="mt-2">
            Close tab
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <EditorHeader
        title={title}
        onTitleChange={handleTitleChange}
        placeholder="Doc title"
        saveStatus={headerSaveStatus}
        onSave={save}
        isDirty={isDirty}
        onDelete={() => setShowDeleteConfirm(true)}
        aiIncluded={!aiExclusionState.isExcluded}
        onAIInclusionChange={handleAIInclusionChange}
        isInExcludedFolder={aiExclusionState.isInExcludedFolder}
        excludedFolderPath={aiExclusionState.excludedFolderPath}
      />

      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <FolderBreadcrumb path={doc.path} />

          <MetadataToolbar
            projectId={currentProjectId}
            onProjectChange={setCurrentProjectId}
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          />

          <div className="mt-6">
            {isEditorReady ? (
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Write your doc in markdown..."
                minHeight="400px"
                onInternalLinkClick={handleInternalLinkClick}
              />
            ) : (
              <div className="h-[400px] border rounded-lg flex items-center justify-center bg-muted/10">
                <LoadingState label="editor" />
              </div>
            )}
          </div>

          {projectChanged && (
            <div className="mt-6 flex justify-end">
              <Button onClick={handleProjectMove} className="min-w-[140px]">
                Move & Save
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Doc"
        description="Are you sure you want to delete this doc? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
