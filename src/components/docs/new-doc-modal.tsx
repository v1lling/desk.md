
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Folder, Sparkles } from "lucide-react";
import { useCreateDoc, useCreateDocInFolder, useProjects, useCurrentWorkspace, useOpenTab } from "@/stores";
import { toast } from "sonner";
import type { ContentScope } from "@/types";
import {
  displayTreePath,
  splitTreePathToKind,
  isAITreePath,
  isReservedAIDocsName,
} from "@/lib/desk/tree-path";
import { useTemplatesStore } from "@/stores/templates";
import { resolveVariables } from "@/lib/templates";

interface NewDocModalProps {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultScope?: ContentScope;
  defaultWorkspaceId?: string;
  /** Tree-relative folder path (may contain the AI Docs sentinel). */
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
  const { openDoc } = useOpenTab();
  const getTemplate = useTemplatesStore((s) => s.getTemplate);

  // Use provided workspaceId or fall back to current workspace
  const workspaceId = defaultWorkspaceId || currentWorkspace?.id;
  const { data: projects = [] } = useProjects(workspaceId || null);

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId || "");

  // Determine scope mode
  const isPersonalScope = defaultScope === "personal";
  const isWorkspaceScope = defaultScope === "workspace";
  const isProjectScope = defaultScope === "project";

  // Translate the tree path into a real on-disk folder + kind
  const { kind: destinationKind, subPath: destinationSubPath } = splitTreePathToKind(defaultFolderPath || "");
  const isAIDestination = isAITreePath(defaultFolderPath || "");

  useEffect(() => {
    if (defaultProjectId) {
      setProjectId(defaultProjectId);
    }
  }, [defaultProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = title.trim();
    if (!trimmed) return;

    // For non-personal scopes, we need a workspace
    if (!isPersonalScope && !workspaceId) return;

    // Block creating a doc whose name would create a reserved-name folder collision.
    // (Docs don't create folders, but be defensive about future automation.)
    if (!isAIDestination && !destinationSubPath && isReservedAIDocsName(trimmed)) {
      toast.error(`"${trimmed}" is a reserved name.`);
      return;
    }

    try {
      const templateBody = resolveVariables(
        getTemplate("doc", workspaceId || ""),
        {
          title: trimmed,
          date: new Date().toISOString().split("T")[0],
          project: projects.find((p) => p.id === (defaultProjectId || projectId))?.name || "",
          workspace: currentWorkspace?.name || "",
        }
      );

      let doc;

      if (isPersonalScope) {
        doc = await createDocInFolder.mutateAsync({
          scope: "personal",
          title: trimmed,
          templateBody: templateBody || undefined,
          folderPath: destinationSubPath,
          kind: destinationKind,
        });
      } else if (isWorkspaceScope) {
        doc = await createDocInFolder.mutateAsync({
          scope: "workspace",
          title: trimmed,
          templateBody: templateBody || undefined,
          folderPath: destinationSubPath,
          workspaceId,
          kind: destinationKind,
        });
      } else if (isProjectScope && defaultProjectId) {
        doc = await createDocInFolder.mutateAsync({
          scope: "project",
          title: trimmed,
          templateBody: templateBody || undefined,
          folderPath: destinationSubPath,
          workspaceId,
          projectId: defaultProjectId,
          kind: destinationKind,
        });
      } else {
        doc = await createDoc.mutateAsync({
          workspaceId: workspaceId!,
          projectId: projectId || "_unassigned",
          title: trimmed,
          templateBody: templateBody || undefined,
          kind: destinationKind,
        });
      }

      toast.success("Doc created");

      // Reset form
      setTitle("");
      onClose();

      // Auto-open in editor tab
      openDoc({
        id: doc.id,
        title: doc.title,
        workspaceId: doc.workspaceId,
        projectId: doc.projectId,
      });
    } catch (error) {
      console.error("Failed to create doc:", error);
      toast.error("Failed to create doc");
    }
  };

  const handleClose = () => {
    setTitle("");
    onClose();
  };

  const isPending = createDoc.isPending || createDocInFolder.isPending;
  const friendlyPath = defaultFolderPath ? displayTreePath(defaultFolderPath) : "";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Doc</DialogTitle>
          <DialogDescription className="sr-only">Create a new document in your workspace</DialogDescription>
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
            friendlyPath && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
                {isAIDestination ? <Sparkles className="size-4" /> : <Folder className="size-4" />}
                <span>Creating in: {friendlyPath}</span>
              </div>
            )
          ) : (
            <FormField label="Project" optional>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-full">
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
