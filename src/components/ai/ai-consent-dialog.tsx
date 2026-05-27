import { Trans, useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { useAIConsentStore } from "@/stores/ai-consent";

/**
 * One-time privacy disclosure shown before the first outbound AI call.
 *
 * Mounted once at the app shell. It is driven entirely by `useAIConsentStore`:
 * `ensureAIConsent()` opens it and awaits the user's choice. Cancelling — via the
 * button, Escape, or an outside click — declines and aborts the AI action.
 */
export function AIConsentDialog() {
  const { t } = useTranslation();
  const isOpen = useAIConsentStore((s) => s.isOpen);
  const resolve = useAIConsentStore((s) => s.resolve);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resolve(false)}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            {t("assistant.consent.title")}
          </DialogTitle>
          <DialogDescription>
            {t("assistant.consent.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">
              {t("assistant.consent.whatHeading")}
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>{t("assistant.consent.whatItems.messages")}</li>
              <li>{t("assistant.consent.whatItems.previews")}</li>
              <li>{t("assistant.consent.whatItems.fileContents")}</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">
              {t("assistant.consent.whenHeading")}
            </p>
            <p className="mt-1">
              <Trans
                i18nKey="assistant.consent.whenBody"
                components={{ strong: <span className="font-medium text-foreground" /> }}
              />
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">
              {t("assistant.consent.retentionHeading")}
            </p>
            <p className="mt-1">{t("assistant.consent.retentionBody")}</p>
          </div>
          <p>{t("assistant.consent.footer")}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => resolve(false)}>
            {t("common.buttons.cancel")}
          </Button>
          <Button onClick={() => resolve(true)}>
            {t("assistant.consent.accept")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
