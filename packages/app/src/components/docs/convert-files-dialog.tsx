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

export type ConvertChoice = "convert" | "keep" | "both";

interface ConvertFilesDialogProps {
  open: boolean;
  filenames: string[];
  onChoice: (choice: ConvertChoice) => void;
  onCancel: () => void;
}

export function ConvertFilesDialog({
  open,
  filenames,
  onChoice,
  onCancel,
}: ConvertFilesDialogProps) {
  const { t } = useTranslation();

  const previewLimit = 5;
  const previewFiles = filenames.slice(0, previewLimit);
  const overflow = filenames.length - previewFiles.length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("pages.docs.convertDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("pages.docs.convertDialog.description", { count: filenames.length })}
          </DialogDescription>
        </DialogHeader>

        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-0.5 max-h-40 overflow-auto">
          {previewFiles.map((name) => (
            <li key={name} className="truncate">{name}</li>
          ))}
          {overflow > 0 && (
            <li className="italic">
              {t("pages.docs.convertDialog.moreFiles", { count: overflow })}
            </li>
          )}
        </ul>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t("common.buttons.cancel")}
          </Button>
          <Button variant="ghost" onClick={() => onChoice("keep")}>
            {t("pages.docs.convertDialog.buttons.keep")}
          </Button>
          <Button variant="ghost" onClick={() => onChoice("both")}>
            {t("pages.docs.convertDialog.buttons.both")}
          </Button>
          <Button onClick={() => onChoice("convert")}>
            {t("pages.docs.convertDialog.buttons.convert")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
