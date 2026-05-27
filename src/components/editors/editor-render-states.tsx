/**
 * Shared render states for all editor components.
 * Handles: file deleted, file moved, loading, and not-found states.
 * Returns null if none apply (editor should render normally).
 */
import { useTranslation } from "react-i18next";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { FileMovedBanner, FileDeletedBanner } from "@/components/ui/editor-banners";

interface EditorRenderStatesProps {
  fileDeleted: boolean;
  pathChanged: boolean;
  newPath: string | null;
  isLoading: boolean;
  entity: unknown | null | undefined;
  entityLabel: string;
  onClose: () => void;
  acknowledgePathChange: () => void;
  acknowledgeDeleted: () => void;
  /** True if the editor has unsaved edits that can be restored */
  isDirty?: boolean;
  /** Re-create the file from in-memory edits */
  onRecover?: () => void;
}

export function EditorRenderStates({
  fileDeleted,
  pathChanged,
  newPath,
  isLoading,
  entity,
  entityLabel,
  onClose,
  acknowledgePathChange,
  acknowledgeDeleted,
  isDirty,
  onRecover,
}: EditorRenderStatesProps) {
  const { t } = useTranslation();

  // Translated, capitalized entity name used in "<Entity> not found".
  const entityKeyMap: Record<string, string> = {
    doc: "editors.shared.entityName.doc",
    task: "editors.shared.entityName.task",
    meeting: "editors.shared.entityName.meeting",
  };
  const entityName =
    entityKeyMap[entityLabel] !== undefined
      ? t(entityKeyMap[entityLabel])
      : entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1);

  if (fileDeleted) {
    return (
      <FileDeletedBanner
        hasUnsavedEdits={isDirty}
        onRecover={onRecover}
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

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <LoadingState label={entityLabel} display="inline" />
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <p>{t("editors.shared.entityNotFound", { entity: entityName })}</p>
          <Button variant="ghost" onClick={onClose} className="mt-2">
            {t("editors.shared.closeTab")}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
