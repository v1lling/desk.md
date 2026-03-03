
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
  title = "Unsaved Changes",
  description = "Do you want to save the changes you made?",
  onSave,
  onDontSave,
  onCancel,
}: SaveChangesDialogProps) {
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={handleDontSave}>
            Don&apos;t Save
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
