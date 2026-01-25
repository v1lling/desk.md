"use client";

import { useDoc } from "@/stores";
import { useDocForm } from "@/components/docs/use-doc-form";
import { useEditorTab } from "@/hooks";
import { EditorHeader } from "./editor-header";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { MetadataToolbar } from "@/components/ui/metadata-toolbar";
import { LoadingState } from "@/components/ui/loading-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Folder, ChevronRight } from "lucide-react";

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

export function DocEditor({ docId, workspaceId, projectId, onClose }: DocEditorProps) {
  const { data: doc, isLoading } = useDoc(workspaceId, docId);

  const form = useDocForm(doc || null, {
    enabled: !!doc,
    onDeleted: onClose,
    onClose,
  });

  // Manage tab title and dirty state
  useEditorTab(`doc-${docId}`, form.title, form.isDirty);

  if (isLoading) {
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
        title={form.title}
        onTitleChange={form.setTitle}
        placeholder="Doc title"
        saveStatus={form.saveStatus}
        onDelete={() => form.setShowDeleteConfirm(true)}
      />

      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <FolderBreadcrumb path={doc.path} />

          <MetadataToolbar
            projectId={form.projectId}
            onProjectChange={form.setProjectId}
            projects={form.projects}
          />

          <div className="mt-6">
            {form.isEditorReady ? (
              <RichTextEditor
                value={form.content}
                onChange={form.setContent}
                placeholder="Write your doc in markdown..."
                minHeight="400px"
              />
            ) : (
              <div className="h-[400px] border rounded-lg flex items-center justify-center bg-muted/10">
                <LoadingState label="editor" />
              </div>
            )}
          </div>

          {form.projectChanged && (
            <div className="mt-6 flex justify-end">
              <Button onClick={form.handleSave} className="min-w-[140px]">
                Move & Save
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      <ConfirmDialog
        open={form.showDeleteConfirm}
        onOpenChange={form.setShowDeleteConfirm}
        title="Delete Doc"
        description="Are you sure you want to delete this doc? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={form.handleDeleteConfirm}
      />
    </div>
  );
}
