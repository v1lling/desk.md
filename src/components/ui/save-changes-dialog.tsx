
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SaveChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onSave: () => void;
  onDontSave: () => void;
  onCancel: () => void;
}

/**
 * SaveChangesDialog - Three-button dialog for unsaved changes
 *
 * Standard macOS/Windows pattern:
 * - Save: Save changes and proceed
 * - Don't Save: Discard changes and proceed
 * - Cancel: Abort the operation
 */
export function SaveChangesDialog({
  open,
  onOpenChange,
  title,
  description,
  onSave,
  onDontSave,
  onCancel,
}: SaveChangesDialogProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("ui.saveChanges.title");
  const resolvedDescription = description ?? t("ui.saveChanges.description");
  const handleSave = () => {
    onSave();
    onOpenChange(false);
  };

  const handleDontSave = () => {
    onDontSave();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription>{resolvedDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCancel}>
            {t("common.buttons.cancel")}
          </Button>
          <Button variant="ghost" onClick={handleDontSave}>
            {t("common.buttons.dontSave")}
          </Button>
          <Button onClick={handleSave}>{t("common.buttons.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
