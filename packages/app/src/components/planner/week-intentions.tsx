/**
 * WeekIntentions — up to three short lines answering "what is this week about?".
 *
 * A row, not a panel: the whole point is that it costs almost no vertical space. The
 * click-to-edit interaction mirrors MiniNoteItem exactly (Enter commits, Escape reverts,
 * blur commits, empty clears) so the two feel like the same control.
 */

import { useEffect, useRef, useState } from "react";
import { Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { MAX_INTENTIONS } from "@/stores/planner";

interface WeekIntentionsProps {
  intentions: string[];
  onChange: (index: number, text: string) => void;
}

export function WeekIntentions({ intentions, onChange }: WeekIntentionsProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing !== null) inputRef.current?.focus();
  }, [editing]);

  const startEdit = (index: number) => {
    setDraft(intentions[index] ?? "");
    setEditing(index);
  };

  const commit = () => {
    if (editing === null) return;
    onChange(editing, draft);
    setEditing(null);
    setDraft("");
  };

  return (
    <div className="h-8 shrink-0 border-b border-border/40 px-4 flex items-center gap-1.5">
      <Target className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />

      {intentions.map((intention, index) =>
        editing === index ? (
          <input
            key={index}
            ref={inputRef}
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setEditing(null);
                setDraft("");
              }
            }}
            className="text-xs px-2 py-0.5 rounded bg-background border focus:outline-none focus:ring-1 focus:ring-primary/30 min-w-[8rem]"
          />
        ) : (
          <button
            key={index}
            onClick={() => startEdit(index)}
            className="text-xs px-2 py-0.5 rounded bg-muted/40 text-muted-foreground/90 hover:bg-muted/70 transition-colors truncate max-w-[16rem]"
          >
            {intention}
          </button>
        )
      )}

      {editing === intentions.length && (
        <input
          ref={inputRef}
          value={draft}
          maxLength={60}
          placeholder={t("pages.planner.intentions.placeholder")}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setEditing(null);
              setDraft("");
            }
          }}
          className="text-xs px-2 py-0.5 rounded bg-background border focus:outline-none focus:ring-1 focus:ring-primary/30 min-w-[12rem]"
        />
      )}

      {intentions.length < MAX_INTENTIONS && editing !== intentions.length && (
        <button
          onClick={() => startEdit(intentions.length)}
          className={cn(
            "text-[11px] px-1.5 py-0.5 rounded transition-colors",
            "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/40"
          )}
        >
          + {t("pages.planner.intentions.add")}
        </button>
      )}
    </div>
  );
}
