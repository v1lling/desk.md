
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDoc, useUpdateDoc, useDeleteDoc, useMoveDocToProject, useProjects } from "@/stores";
import { indexDocumentOnSave } from "@/lib/context-index/indexer";
import { useEditorSession, useEditorTab, useEditorSaveShortcut, useEditorSaveAndClose, useEditorProjectMove, useEditorAIInclusion } from "@/hooks/editor";
import { useInternalLinkHandler } from "@/hooks";
import { EditorHeader } from "./editor-header";
import { EditorPathBar } from "./editor-path-bar";
import { EditorRenderStates } from "./editor-render-states";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface DocEditorProps {
  docId: string;
  workspaceId: string;
  projectId?: string;
  onClose: () => void;
}

export function DocEditor({ docId, workspaceId, onClose }: DocEditorProps) {
  const tabId = `doc-${docId}`;
  const handleInternalLinkClick = useInternalLinkHandler();

  const { data: doc, isLoading: isLoadingDoc } = useDoc(workspaceId, docId);
  const { data: projects = [] } = useProjects(workspaceId);

  // Mutations
  const updateDoc = useUpdateDoc();
  const deleteDoc = useDeleteDoc();
  const moveDocToProject = useMoveDocToProject();

  // Local state
  const [title, setTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Shared hooks
  const { aiExclusionState, handleAIInclusionChange } = useEditorAIInclusion(
    doc?.filePath,
    workspaceId,
    "doc"
  );

  // Initialize local state from doc
  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setIsEditorReady(false);
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
    acceptPathChange,
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

  // Shared save hooks
  useEditorSaveShortcut(save);
  useEditorSaveAndClose(tabId, save);

  // Project move
  const { currentProjectId, handleProjectChange } = useEditorProjectMove({
    entity: doc,
    save,
    acceptPathChange,
    move: moveDocToProject.mutateAsync,
    entityLabel: "doc",
    buildMoveArgs: (id, ws, from, to) => ({ docId: id, workspaceId: ws, fromProjectId: from, toProjectId: to }),
  });

  // Defer editor rendering
  useEffect(() => {
    if (doc && !isLoadingContent && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [doc, isLoadingContent, isEditorReady]);

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      setTitle(newTitle);
      if (doc) {
        try {
          await updateDoc.mutateAsync({
            doc,
            updates: { title: newTitle.trim() || doc.title, content: getCurrentContent() },
          });
        } catch (error) {
          console.error("[doc-editor] Failed to save title:", error);
        }
      }
    },
    [doc, updateDoc, getCurrentContent]
  );

  // Manage tab title and dirty state
  const isDirty = contentDirty;
  useEditorTab(tabId, title, isDirty);

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

  const headerSaveStatus = useMemo(() => {
    if (saveStatus === "saving") return "saving" as const;
    if (saveStatus === "error") return "error" as const;
    return "idle" as const;
  }, [saveStatus]);

  // Scroll-aware border on sticky header
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Render states (deleted, moved, loading, not found)
  const renderState = EditorRenderStates({
    fileDeleted,
    pathChanged,
    newPath,
    isLoading: isLoadingDoc,
    entity: doc,
    entityLabel: "doc",
    onClose,
    acknowledgePathChange,
    acknowledgeDeleted,
  });
  if (renderState) return renderState;

  // TypeScript can't narrow through EditorRenderStates — doc is guaranteed non-null here
  if (!doc) return null;

  return (
    <div className="flex flex-col h-full bg-background">
      <EditorPathBar filePath={doc.filePath} />
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
        scrolled={scrolled}
      />

      <ScrollArea className="flex-1 min-h-0">
        <div ref={sentinelRef} className="h-0" />
        <div className="max-w-4xl mx-auto px-6 pt-2 pb-6">
          <MetadataToolbar
            projectId={currentProjectId}
            onProjectChange={handleProjectChange}
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          />

          <div className="h-px bg-border/40 my-4" />

          {isEditorReady ? (
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Write your doc in markdown..."
              minHeight="400px"
              borderless
              onInternalLinkClick={handleInternalLinkClick}
            />
          ) : (
            <div className="h-[400px] flex items-center justify-center">
              <LoadingState label="editor" display="inline" />
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
