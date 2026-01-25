"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Folder } from "lucide-react";
import { useCreateDoc, useCreateDocInFolder, useProjects, useCurrentWorkspace } from "@/stores";
import { toast } from "sonner";
import type { DocScope } from "@/types";

interface NewDocModalProps {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultScope?: DocScope;
  defaultWorkspaceId?: string;
  defaultFolderPath?: string;
}

export function NewDocModal({
  open,
  onClose,
  defaultProjectId,
  defaultScope,
  defaultWorkspaceId,
  defaultFolderPath,
}: NewDocModalProps) {
  const currentWorkspace = useCurrentWorkspace();
  const createDoc = useCreateDoc();
  const createDocInFolder = useCreateDocInFolder();

  // Use provided workspaceId or fall back to current workspace
  const workspaceId = defaultWorkspaceId || currentWorkspace?.id;
  const { data: projects = [] } = useProjects(workspaceId || null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId || "");

  // Determine scope mode
  const isPersonalScope = defaultScope === "personal";
  const isWorkspaceScope = defaultScope === "workspace";
  const isProjectScope = defaultScope === "project";

  useEffect(() => {
    if (defaultProjectId) {
      setProjectId(defaultProjectId);
    }
  }, [defaultProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    // For non-personal scopes, we need a workspace
    if (!isPersonalScope && !workspaceId) return;

    try {
      if (isPersonalScope) {
        // Create in personal docs folder
        await createDocInFolder.mutateAsync({
          scope: "personal",
          title: title.trim(),
          content: content || undefined,
          folderPath: defaultFolderPath,
        });
      } else if (isWorkspaceScope) {
        // Create in workspace docs folder (with optional folder path)
        await createDocInFolder.mutateAsync({
          scope: "workspace",
          title: title.trim(),
          content: content || undefined,
          folderPath: defaultFolderPath,
          workspaceId: workspaceId,
        });
      } else if (isProjectScope && defaultProjectId) {
        // Create in specific project docs folder
        await createDocInFolder.mutateAsync({
          scope: "project",
          title: title.trim(),
          content: content || undefined,
          folderPath: defaultFolderPath,
          workspaceId: workspaceId,
          projectId: defaultProjectId,
        });
      } else {
        // Create in project docs folder (user selects project)
        await createDoc.mutateAsync({
          workspaceId: workspaceId!,
          projectId: projectId || "_unassigned",
          title: title.trim(),
          content: content || undefined,
        });
      }

      toast.success("Doc created");

      // Reset form
      setTitle("");
      setContent("");
      onClose();
    } catch (error) {
      console.error("Failed to create doc:", error);
      toast.error("Failed to create doc");
    }
  };

  const handleClose = () => {
    setTitle("");
    setContent("");
    onClose();
  };

  const isPending = createDoc.isPending || createDocInFolder.isPending;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Doc</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <FormField id="doc-title" label="Title">
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Doc title"
              autoFocus
            />
          </FormField>

          {/* Show folder path for personal/workspace/project scopes */}
          {(isPersonalScope || isWorkspaceScope || isProjectScope) ? (
            defaultFolderPath && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
                <Folder className="size-4" />
                <span>Creating in: {defaultFolderPath}</span>
              </div>
            )
          ) : (
            <FormField label="Project" optional>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          <FormField id="doc-content" label="Content" optional>
            <Textarea
              id="doc-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing..."
              className="min-h-[120px] resize-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isPending}
            >
              {isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Doc
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
