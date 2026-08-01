
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InlineProgress } from "@/components/ui/inline-progress";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Folder } from "lucide-react";
import { useCreateDoc, useCreateDocInFolder, useProjects, useCurrentWorkspace, useOpenTab } from "@/stores";
import { toast } from "sonner";
import type { ContentScope } from "@desk/core/types";
import {
  displayTreePath,
  todayISO,
} from "@desk/core";
import { useTemplatesStore } from "@/stores/templates";
import { resolveVariables } from "@/lib/templates";

interface NewDocModalProps {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultScope?: ContentScope;
  defaultWorkspaceId?: string;
  /** Tree-relative folder path. */
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
  const { t } = useTranslation();
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

  const destinationSubPath = defaultFolderPath || "";

  // A dialog stays mounted while closed, so form state would otherwise leak across opens —
  // and across workspace switches, where a kept projectId points at another workspace's
  // project (the doc would land in projects/<foreign-id>/, inventing a project dir with
  // no project.md). Reset the whole form on open; it is the single reset.
  useEffect(() => {
    if (open) {
      setTitle("");
      setProjectId(defaultProjectId || "");
    }
  }, [open, defaultProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = title.trim();
    if (!trimmed) return;

    // For non-personal scopes, we need a workspace
    if (!isPersonalScope && !workspaceId) return;

    try {
      const templateBody = resolveVariables(
        getTemplate("doc", workspaceId || ""),
        {
          title: trimmed,
          date: todayISO(),
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
        });
      } else if (isWorkspaceScope) {
        doc = await createDocInFolder.mutateAsync({
          scope: "workspace",
          title: trimmed,
          templateBody: templateBody || undefined,
          folderPath: destinationSubPath,
          workspaceId,
        });
      } else if (isProjectScope && defaultProjectId) {
        doc = await createDocInFolder.mutateAsync({
          scope: "project",
          title: trimmed,
          templateBody: templateBody || undefined,
          folderPath: destinationSubPath,
          workspaceId,
          projectId: defaultProjectId,
        });
      } else {
        doc = await createDoc.mutateAsync({
          workspaceId: workspaceId!,
          projectId: projectId || "_unassigned",
          title: trimmed,
          templateBody: templateBody || undefined,
        });
      }

      toast.success(t("toasts.doc.created"));

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
      toast.error(t("errors.doc.createFailed"));
    }
  };

  const isPending = createDoc.isPending || createDocInFolder.isPending;
  const friendlyPath = defaultFolderPath ? displayTreePath(defaultFolderPath) : "";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("modals.newDoc.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("modals.newDoc.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <FormField id="doc-title" label={t("modals.newDoc.fields.title")}>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("modals.newDoc.placeholders.title")}
              autoFocus
            />
          </FormField>

          {/* Show folder path for personal/workspace/project scopes */}
          {(isPersonalScope || isWorkspaceScope || isProjectScope) ? (
            friendlyPath && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
                <Folder className="size-4" />
                <span>{t("modals.newDoc.creatingIn", { path: friendlyPath })}</span>
              </div>
            )
          ) : (
            <FormField label={t("modals.newDoc.fields.project")} optional>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("modals.newDoc.placeholders.noProject")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("modals.newDoc.placeholders.noProject")}</SelectItem>
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
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.buttons.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isPending}
            >
              {isPending && (
                <InlineProgress />
              )}
              {t("modals.newDoc.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
