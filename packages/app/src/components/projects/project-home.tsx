import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatePanel } from "@/components/ui/state-panel";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EntityOverview } from "@/components/entity-overview";
import { ProjectHomeHeader } from "@/components/projects/project-home-header";
import {
  ActivitySection,
  DocsSection,
  MeetingsSection,
  TasksSection,
} from "@/components/projects/project-home-sections";
import { useProject, useUpdateProject, useDeleteProject } from "@/stores";
import { useProjectSelectionStore } from "@/stores/project-selection";
import type { ProjectUpdate } from "@desk/core/types";

interface ProjectHomeProps {
  workspaceId: string;
  projectId: string;
}

/**
 * The project's home: header (name, description, status, task counts), the overview,
 * active tasks with quick-add, recent meetings, recent docs, and recent activity.
 */
export function ProjectHome({ workspaceId, projectId }: ProjectHomeProps) {
  const { t } = useTranslation();
  const { data: project, isLoading } = useProject(workspaceId, projectId);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const setSelectedProject = useProjectSelectionStore((state) => state.setSelectedProject);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleUpdate = async (updates: ProjectUpdate) => {
    try {
      await updateProject.mutateAsync({ projectId, workspaceId, updates });
    } catch (error) {
      console.error("Failed to update project:", error);
      toast.error(t("toasts.project.update.error"));
      throw error;
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProject.mutateAsync({ projectId, workspaceId });
      setSelectedProject(null);
      toast.success(t("toasts.project.delete.success"));
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast.error(t("toasts.project.delete.error"));
    }
  };

  if (isLoading) {
    return <LoadingSkeleton variant="page" />;
  }

  if (!project) {
    return (
      <StatePanel
        variant="notFound"
        icon={FolderKanban}
        title={t("pages.projects.home.notFoundTitle")}
        description={t("pages.projects.home.notFoundDescription")}
        className="h-full"
      />
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="mx-auto max-w-3xl px-6 py-6 space-y-6">
          <ProjectHomeHeader
            project={project}
            onUpdate={handleUpdate}
            onDeleteRequest={() => setConfirmDelete(true)}
          />
          <EntityOverview
            title={t("pages.projects.home.overview.title")}
            value={project.overview ?? ""}
            placeholder={t("pages.projects.home.overview.placeholder")}
            onSave={async (overview) => {
              await updateProject.mutateAsync({
                projectId,
                workspaceId,
                updates: { overview },
              });
            }}
          />
          <TasksSection workspaceId={workspaceId} projectId={projectId} />
          <MeetingsSection workspaceId={workspaceId} projectId={projectId} />
          <DocsSection workspaceId={workspaceId} projectId={projectId} />
          <ActivitySection workspaceId={workspaceId} projectId={projectId} />
        </div>
      </ScrollArea>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("pages.projects.deleteConfirmTitle")}
        description={t("pages.projects.deleteConfirmDescription", { name: project.name })}
        confirmLabel={t("common.buttons.delete")}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
