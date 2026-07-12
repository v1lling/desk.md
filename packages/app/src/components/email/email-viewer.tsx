import { useState, useEffect, useCallback } from "react";
import { ExternalLink, ChevronRight, Copy, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IncomingEmail } from "@/lib/email/types";
import {
  formatEmailAddress,
  formatEmailDate,
  buildEmailPlainText,
} from "@/lib/email/types";

interface EmailViewerProps {
  email: IncomingEmail;
}

export function EmailViewer({ email }: EmailViewerProps) {
  const { t } = useTranslation();
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Reset view state when a different email lands in this tab.
    setBodyExpanded(false);
    setCopied(false);
  }, [email]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(buildEmailPlainText(email));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [email]);

  const sourceKey = (() => {
    switch (email.source) {
      case "apple-mail":
        return "email.viewer.source.appleMail";
      case "outlook":
        return "email.viewer.source.outlook";
      case "thunderbird":
        return "email.viewer.source.thunderbird";
      default:
        return "email.viewer.source.other";
    }
  })();
  const sourceDisplayName = email.source ? t(sourceKey) : null;
  const subtitleParts = [
    formatEmailAddress(email.from),
    email.date ? formatEmailDate(email.date) : null,
    sourceDisplayName ? t("email.viewer.viaSource", { source: sourceDisplayName }) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="shrink-0 bg-background">
        <div className="max-w-4xl mx-auto px-6 py-2">
          <h1 className="text-xl font-semibold truncate">
            {email.subject || t("email.viewer.noSubject")}
          </h1>
          {subtitleParts.length > 0 && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {subtitleParts.join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0">
        <div className="max-w-4xl mx-auto px-6">
          <div className="h-px bg-border/40 mt-4" />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-4xl mx-auto px-6 pt-3 pb-6 space-y-5">
          <div>
            <button
              type="button"
              onClick={() => setBodyExpanded((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              aria-expanded={bodyExpanded}
            >
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  bodyExpanded && "rotate-90",
                )}
              />
              {bodyExpanded ? t("email.viewer.hideFull") : t("email.viewer.showFull")}
            </button>
            {bodyExpanded && (
              <div className="mt-3 rounded-lg border bg-card max-h-[40vh] overflow-auto">
                <div className="p-4 space-y-3">
                  {(email.to?.length || email.cc?.length) && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {email.to && email.to.length > 0 && (
                        <div className="truncate">
                          <span className="font-medium">{t("email.viewer.toLabel")} </span>
                          {email.to.map(formatEmailAddress).join(", ")}
                        </div>
                      )}
                      {email.cc && email.cc.length > 0 && (
                        <div className="truncate">
                          <span className="font-medium">{t("email.viewer.ccLabel")} </span>
                          {email.cc.map(formatEmailAddress).join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {email.body}
                  </pre>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {t("email.replyHelper.copied")}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  {t("email.replyHelper.copyEmail")}
                </>
              )}
            </Button>
            <Button variant="outline" disabled>
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("email.replyHelper.extractTasks")}
              <span className="ml-2 text-xs text-muted-foreground">{t("email.replyHelper.comingSoon")}</span>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("email.replyHelper.mcpHint")}
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}
