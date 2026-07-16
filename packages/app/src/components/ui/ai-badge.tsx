import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Provenance mark: "this file was written by AI" (`Doc.author === "ai"`).
 *
 * A quiet text chip, deliberately not an icon — the icon vocabulary is taken: Bot/BotOff is
 * the AI-inclusion toggle ("can the AI read this?") and Sparkles marks AI actions/features.
 * Display-only: provenance is who originated the file, it never flips on edit.
 */
export function AIBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  const label = t("pages.docs.authorAi");
  return (
    <span
      className={cn(
        "shrink-0 rounded bg-muted px-1 text-[10px] font-medium leading-4 text-muted-foreground",
        className,
      )}
      title={label}
      aria-label={label}
    >
      {t("common.aiBadge")}
    </span>
  );
}
