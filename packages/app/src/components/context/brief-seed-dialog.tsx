import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import type { BriefSeed } from "@desk/core";

interface BriefSeedDialogProps {
  open: boolean;
  onClose: () => void;
  /** Prefills "What this is" — the project description already answers that question. */
  defaultDescription?: string;
  onSubmit: (seed: BriefSeed) => Promise<void>;
  isPending?: boolean;
}

/**
 * The two questions an AI can never answer for itself: what this project is, and what it runs
 * on. Everything else in the brief is reconciled from the records; this is the seed.
 *
 * Shown at project creation (inline in the New Project modal) and again from the Context panel
 * for projects that have no brief yet.
 */
export function BriefSeedDialog({
  open,
  onClose,
  defaultDescription,
  onSubmit,
  isPending,
}: BriefSeedDialogProps) {
  const { t } = useTranslation();
  const [description, setDescription] = useState("");
  const [systems, setSystems] = useState("");

  useEffect(() => {
    if (open) {
      setDescription(defaultDescription ?? "");
      setSystems("");
    }
  }, [open, defaultDescription]);

  const canSubmit = Boolean(description.trim() || systems.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isPending) return;
    await onSubmit({ description: description.trim(), systems: systems.trim() });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t("modals.brief.title")}</DialogTitle>
          <DialogDescription>{t("modals.brief.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <FormField id="brief-what" label={t("modals.brief.whatLabel")}>
            <Textarea
              id="brief-what"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("modals.brief.whatPlaceholder")}
              className="min-h-[80px] resize-none"
              autoFocus
            />
          </FormField>

          <FormField id="brief-systems" label={t("modals.brief.systemsLabel")} optional>
            <Textarea
              id="brief-systems"
              value={systems}
              onChange={(e) => setSystems(e.target.value)}
              placeholder={t("modals.brief.systemsPlaceholder")}
              className="min-h-[60px] resize-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.buttons.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit || isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("modals.brief.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
