
import { useState, useEffect, useCallback, useMemo } from "react";
import { useDoc, useUpdateDoc, useDeleteDoc, useMoveDocToProject, useProjects } from "@/stores";
import { indexDocumentOnSave } from "@/hooks/use-rag-indexer";
import { useEditorSession } from "@/hooks/use-editor-session";
import { useEditorTab, useInternalLinkHandler } from "@/hooks";
import { useEditorSaveShortcut } from "@/hooks/use-editor-save-shortcut";
import { useEditorSaveAndClose } from "@/hooks/use-editor-save-and-close";
import { useEditorAIInclusion } from "@/hooks/use-editor-ai-inclusion";
import { EditorHeader } from "./editor-header";
import { EditorRenderStates } from "./editor-render-states";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [currentProjectId, setCurrentProjectId] = useState("");
  const [originalProjectId, setOriginalProjectId] = useState("");
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
      setCurrentProjectId(doc.projectId);
      setOriginalProjectId(doc.projectId);
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

  // Project change — auto-move immediately
  const handleProjectChange = useCallback(async (newProjectId: string) => {
    setCurrentProjectId(newProjectId);
    if (!doc || newProjectId === originalProjectId) return;

    try {
      const saved = await save();
      if (!saved) {
        setCurrentProjectId(originalProjectId);
        toast.error("Save failed — cannot move doc");
        return;
      }

      const result = await moveDocToProject.mutateAsync({
        docId: doc.id,
        workspaceId: doc.workspaceId,
        fromProjectId: originalProjectId,
        toProjectId: newProjectId,
      });

      if (result?.filePath) {
        acceptPathChange(result.filePath);
      }
      setOriginalProjectId(newProjectId);
    } catch {
      setCurrentProjectId(originalProjectId);
      toast.error("Failed to move doc");
    }
  }, [doc, originalProjectId, moveDocToProject, acceptPathChange, save]);

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
            onProjectChange={handleProjectChange}
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
