/**
 * Editor Banners
 *
 * Warning banners shown when a file has been moved, renamed, or deleted
 * while it's open in an editor tab.
 */

import { AlertTriangle, FileX, FolderInput } from "lucide-react";
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
  // Extract just the filename from the path for display
  const fileName = newPath.split("/").pop() || newPath;

  return (
    <div className="h-full flex items-center justify-center bg-background">
      <div className="max-w-md text-center space-y-4 p-6">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
          <FolderInput className="h-6 w-6 text-amber-500" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">File Moved</h3>
          <p className="text-sm text-muted-foreground mt-1">
            This file has been moved or renamed externally.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            New location: <code className="text-xs bg-muted px-1 py-0.5 rounded">{fileName}</code>
          </p>
        </div>
        <Button onClick={onAcknowledge}>
          Continue Editing
        </Button>
      </div>
    </div>
  );
}

interface FileDeletedBannerProps {
  /** Called when user acknowledges the deletion (editor tab will close) */
  onClose: () => void;
}

/**
 * Banner shown when a file has been deleted while being edited.
 * User must acknowledge and the tab will close.
 */
export function FileDeletedBanner({ onClose }: FileDeletedBannerProps) {
  return (
    <div className="h-full flex items-center justify-center bg-background">
      <div className="max-w-md text-center space-y-4 p-6">
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <FileX className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">File Deleted</h3>
          <p className="text-sm text-muted-foreground mt-1">
            This file has been deleted from the file system.
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Close Tab
        </Button>
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
  if (!hasExternalChange) return null;

  return (
    <div className="flex items-center gap-1.5 text-amber-500 text-xs">
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>External changes detected</span>
    </div>
  );
}
