import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { applySectionSelection, type SectionChange, type SectionMergeResult } from "@desk/core";

interface RefreshPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  originalBody: string;
  result: SectionMergeResult | null;
  /** Rejects when the write fails, which keeps this dialog open on the reviewed merge. */
  onApply: (content: string) => Promise<void>;
  onRetry: () => void;
  isApplying?: boolean;
  isRefreshing?: boolean;
}

/** A section the model may change, i.e. one worth showing a checkbox for. */
function isEditable(change: SectionChange): boolean {
  return change.owner !== "human" && change.status !== "unchanged";
}

/**
 * Section-level preview of an AI refresh.
 *
 * The section, not the line, is the unit of decision: half-accepting a model's prose produces an
 * incoherent section, so there is deliberately no line diff here. Human-owned sections are shown
 * locked, because the merge in core has already restored them and no checkbox could change that.
 */
export function RefreshPreviewDialog({
  open,
  onClose,
  originalBody,
  result,
  onApply,
  onRetry,
  isApplying,
  isRefreshing,
}: RefreshPreviewDialogProps) {
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const editable = useMemo(
    () => (result?.sections ?? []).filter(isEditable),
    [result],
  );

  useEffect(() => {
    if (open) {
      setAccepted(new Set(editable.map((c) => c.heading)));
      setExpanded(new Set());
    }
  }, [open, editable]);

  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const handleApply = async () => {
    if (!result) return;
    try {
      await onApply(applySectionSelection(originalBody, result, accepted));
      onClose();
    } catch {
      // `onApply` has already surfaced the failure. Stay open on the merge the user just
      // reviewed, so Apply can be retried instead of the work being lost behind a toast.
    }
  };

  const nothingToApply = editable.length === 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{t("modals.refreshBrief.title")}</DialogTitle>
          <DialogDescription>{t("modals.refreshBrief.description")}</DialogDescription>
        </DialogHeader>

        {result && !result.usable ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" />
            <p className="text-muted-foreground">{t("modals.refreshBrief.unusable")}</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[420px] -mx-2">
            <div className="space-y-3 px-2">
              {result?.warnings.length ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-muted-foreground space-y-1">
                  {summarizeWarnings(result, t).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              ) : null}

              {result?.sections.map((change) => {
                const locked = change.owner === "human";
                const changed = change.status !== "unchanged";
                const isOpen = expanded.has(change.heading);
                return (
                  <div
                    key={change.heading}
                    className={cn(
                      "rounded-lg border p-3",
                      changed && !locked ? "border-border" : "border-border/50 bg-muted/20",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {isEditable(change) ? (
                        <input
                          type="checkbox"
                          className="size-3.5 shrink-0 accent-primary cursor-pointer"
                          checked={accepted.has(change.heading)}
                          onChange={() => setAccepted((prev) => toggle(prev, change.heading))}
                          aria-label={change.heading}
                        />
                      ) : locked ? (
                        <Lock className="size-3.5 text-muted-foreground/60" />
                      ) : null}
                      <span className="text-sm font-medium flex-1 truncate">{change.heading}</span>
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                        {locked
                          ? t("modals.refreshBrief.status.yours")
                          : t(`modals.refreshBrief.status.${change.status}`)}
                      </span>
                    </div>

                    {changed && !locked ? (
                      <>
                        <pre className="whitespace-pre-wrap text-sm text-foreground/90 font-sans">
                          {change.after || t("modals.refreshBrief.emptySection")}
                        </pre>
                        {change.before ? (
                          <button
                            type="button"
                            onClick={() => setExpanded((prev) => toggle(prev, change.heading))}
                            className="mt-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            {isOpen
                              ? t("modals.refreshBrief.hidePrevious")
                              : t("modals.refreshBrief.showPrevious")}
                          </button>
                        ) : null}
                        {isOpen && change.before ? (
                          <pre className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground/70 font-sans border-l-2 border-border pl-2">
                            {change.before}
                          </pre>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.buttons.cancel")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onRetry}
            disabled={isApplying || isRefreshing}
          >
            {isRefreshing && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("modals.refreshBrief.retry")}
          </Button>
          {result?.usable ? (
            <Button
              type="button"
              onClick={handleApply}
              disabled={isApplying || isRefreshing || nothingToApply}
            >
              {isApplying && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("modals.refreshBrief.apply")}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Warnings are grouped rather than listed one per line: a model that drops six decision lines
 * would otherwise flood the dialog with noise and bury the one warning that matters.
 */
function summarizeWarnings(
  result: SectionMergeResult,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string[] {
  const lines: string[] = [];
  const restored = result.warnings.filter((w) => w.kind === "line-restored").length;
  const dropped = result.warnings.filter((w) => w.kind === "dropped-section").length;
  const touchedHuman = result.warnings.filter((w) => w.kind === "human-section-modified").length;
  const unknown = result.warnings.filter((w) => w.kind === "unknown-section").length;

  if (restored > 0) lines.push(t("modals.refreshBrief.warnings.linesRestored", { count: restored }));
  if (touchedHuman > 0) lines.push(t("modals.refreshBrief.warnings.humanProtected", { count: touchedHuman }));
  if (dropped > 0) lines.push(t("modals.refreshBrief.warnings.sectionsKept", { count: dropped }));
  if (unknown > 0) lines.push(t("modals.refreshBrief.warnings.unknownDropped", { count: unknown }));
  return lines;
}
