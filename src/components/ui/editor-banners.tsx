/**
 * Editor Banners
 *
 * Warning banners shown when a file has been moved, renamed, or deleted
 * while it's open in an editor tab.
 */

import { AlertTriangle, FileX, FolderInput } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./button";

interface FileMovedBannerProps {
  /** The new path where the file was moved to */
  newPath: string;
  /** Called when user acknowledges the move (editor will update its path) */
  onAcknowledge: () => void;
}

/**
 * Banner shown when a file has been moved or renamed while being edited.
 * User must acknowledge before continuing to edit.
 */
export function FileMovedBanner({ newPath, onAcknowledge }: FileMovedBannerProps) {
  const { t } = useTranslation();
  // Extract just the filename from the path for display
  const fileName = newPath.split("/").pop() || newPath;

  return (
    <div className="h-full flex items-center justify-center bg-background">
      <div className="max-w-md text-center space-y-4 p-6">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
          <FolderInput className="h-6 w-6 text-amber-500" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">{t("ui.editorBanners.fileMoved.title")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("ui.editorBanners.fileMoved.description")}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {t("ui.editorBanners.fileMoved.newLocation")} <code className="text-xs bg-muted px-1 py-0.5 rounded">{fileName}</code>
          </p>
        </div>
        <Button onClick={onAcknowledge}>
          {t("ui.editorBanners.fileMoved.continueEditing")}
        </Button>
      </div>
    </div>
  );
}

interface FileDeletedBannerProps {
  /** Called when user acknowledges the deletion (editor tab will close) */
  onClose: () => void;
  /** Whether the editor still has unsaved in-memory edits that can be restored */
  hasUnsavedEdits?: boolean;
  /** Called when user wants to re-create the file from in-memory edits */
  onRecover?: () => void;
}

/**
 * Banner shown when a file has been deleted while being edited.
 * If there are unsaved edits, offers to recover by re-creating the file.
 */
export function FileDeletedBanner({ onClose, hasUnsavedEdits, onRecover }: FileDeletedBannerProps) {
  const { t } = useTranslation();
  return (
    <div className="h-full flex items-center justify-center bg-background">
      <div className="max-w-md text-center space-y-4 p-6">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <FileX className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">{t("ui.editorBanners.fileDeleted.title")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("ui.editorBanners.fileDeleted.description")}
          </p>
          {hasUnsavedEdits && (
            <p className="text-sm text-muted-foreground mt-2">
              {t("ui.editorBanners.fileDeleted.unsavedHint")}
            </p>
          )}
        </div>
        <div className="flex gap-2 justify-center">
          {hasUnsavedEdits && onRecover && (
            <Button onClick={onRecover}>
              {t("ui.editorBanners.fileDeleted.restoreFromEdits")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("ui.editorBanners.fileDeleted.closeTab")}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ExternalChangeIndicatorProps {
  /** Whether there's an external change that hasn't been merged */
  hasExternalChange?: boolean;
}

/**
 * Small indicator shown when external changes are detected.
 * Can be used in the editor header.
 */
export function ExternalChangeIndicator({ hasExternalChange }: ExternalChangeIndicatorProps) {
  const { t } = useTranslation();
  if (!hasExternalChange) return null;

  return (
    <div className="flex items-center gap-1.5 text-amber-500 text-xs">
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>{t("ui.editorBanners.externalChange")}</span>
    </div>
  );
}
