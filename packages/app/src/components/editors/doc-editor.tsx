
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDoc, useUpdateDoc, useDeleteDoc, useProjects } from "@/stores";
import { WORKSPACE_LEVEL_PROJECT_ID, SPECIAL_DIRS } from "@desk/core";
import { useEditorSession, useEditorTab, useEditorSaveShortcut, useEditorSaveAndClose, useEditorAIInclusion } from "@/hooks/editor";
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
  const { t } = useTranslation();
  const tabId = `doc-${docId}`;
  const handleInternalLinkClick = useInternalLinkHandler();

  const { data: doc, isLoading: isLoadingDoc } = useDoc(workspaceId, docId);
  const { data: projects = [] } = useProjects(workspaceId);

  // Mutations
  const updateDoc = useUpdateDoc();
  const deleteDoc = useDeleteDoc();

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
    // Re-init only when the doc identity changes, not on every metadata edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, workspaceId]);

  // Hosted/web body save: persist through the update mutation (server merges
  // frontmatter). Ignored in Tauri, which writes to disk directly.
  const persistBody = useCallback(
    async (body: string): Promise<boolean> => {
      if (!doc) return false;
      try {
        await updateDoc.mutateAsync({ doc, updates: { content: body } });
        return true;
      } catch (error) {
        console.error("[doc-editor] Failed to persist body:", error);
        return false;
      }
    },
    [doc, updateDoc]
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
    recover,
  } = useEditorSession({
    type: "doc",
    entityId: docId,
    filePath: doc?.filePath,
    // In Tauri the body is loaded fresh from disk; this is only a fallback.
    // In browser mock mode it is the content the editor shows.
    initialContent: doc?.content ?? "",
    enabled: !!doc,
    persistBody,
  });

  // Shared save hooks
  useEditorSaveShortcut(save);
  useEditorSaveAndClose(tabId, save);

  // A doc's location (project / workspace-level / unassigned) is shown read-only in the
  // metadata row; moving a doc happens in the docs tree (drag-drop or the "Move To" menu),
  // which is folder-aware in a way a flat dropdown can't be.
  const projectLabel = useMemo(() => {
    if (!doc) return undefined;
    if (doc.projectId === WORKSPACE_LEVEL_PROJECT_ID) return t("ui.metadataToolbar.workspaceLevel");
    if (doc.projectId === SPECIAL_DIRS.UNASSIGNED) return t("ui.metadataToolbar.noProject");
    return projects.find((p) => p.id === doc.projectId)?.name ?? t("ui.metadataToolbar.noProject");
  }, [doc, projects, t]);

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
      toast.success(t("toasts.editor.docDeleted"));
      setShowDeleteConfirm(false);
      onClose();
    } catch {
      toast.error(t("errors.editor.deleteDocFailed"));
    }
  }, [doc, deleteDoc, onClose, t]);

  const headerSaveStatus = useMemo(() => {
    if (saveStatus === "saving") return "saving" as const;
    if (saveStatus === "error") return "error" as const;
    return "idle" as const;
  }, [saveStatus]);

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
    isDirty: contentDirty,
    onRecover: recover,
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
        placeholder={t("editors.doc.titlePlaceholder")}
        saveStatus={headerSaveStatus}
        onSave={save}
        isDirty={isDirty}
        onDelete={() => setShowDeleteConfirm(true)}
        aiIncluded={!aiExclusionState.isExcluded}
        onAIInclusionChange={handleAIInclusionChange}
        isInExcludedFolder={aiExclusionState.isInExcludedFolder}
        excludedFolderPath={aiExclusionState.excludedFolderPath}
      />

      {/* Sticky metadata row */}
      <div className="shrink-0">
        <div className="max-w-4xl mx-auto px-6">
          <MetadataToolbar
            projectId={doc.projectId}
            projectReadOnly
            projectLabel={projectLabel}
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          />
          <div className="h-px bg-border/40 mt-4" />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {/* pt-3 + the editor's own py-1 (4px) = 16px, symmetric with the divider's mt-4 */}
        <div className="max-w-4xl mx-auto px-6 pt-3 pb-6">
          {isEditorReady ? (
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder={t("editors.doc.contentPlaceholder")}
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
        title={t("editors.doc.deleteTitle")}
        description={t("editors.doc.deleteDescription")}
        confirmLabel={t("common.buttons.delete")}
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
