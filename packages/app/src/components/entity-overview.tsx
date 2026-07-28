import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SectionLabel } from "@/components/patterns";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

interface EntityOverviewProps {
  title: string;
  value: string;
  placeholder: string;
  onSave: (overview: string) => Promise<void>;
}

/** Shared display/edit surface for the user-owned workspace.md/project.md body. */
export function EntityOverview({ title, value, placeholder, onSave }: EntityOverviewProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = draft.trim() !== value.trim();
  const empty = value.trim().length === 0;

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  useUnsavedChangesGuard(
    editing && dirty,
    t("overviews.discardDescription"),
    true,
    title,
  );

  const finishCancel = () => {
    setDraft(value);
    setEditing(false);
    setConfirmDiscard(false);
  };

  const cancel = () => {
    if (dirty) setConfirmDiscard(true);
    else finishCancel();
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (error) {
      console.error("Failed to save overview:", error);
      toast.error(t("toasts.overview.update.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>{title}</SectionLabel>
          {!editing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground"
              onClick={() => setEditing(true)}
            >
              {empty ? <Plus className="size-3.5" /> : <Pencil className="size-3.5" />}
              {t(empty ? "common.buttons.add" : "common.buttons.edit")}
            </Button>
          )}
        </div>

        <RichTextEditor
          value={editing ? draft : value}
          onChange={editing ? setDraft : () => {}}
          placeholder={placeholder}
          borderless={!editing}
          editable={editing}
          autofocus={editing}
          minHeight="60px"
          maxHeight="320px"
          className={editing ? undefined : "bg-transparent"}
        />

        {editing && (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={cancel} disabled={saving}>
              {t("common.buttons.cancel")}
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={!dirty || saving}>
              {saving ? t("common.buttons.saving") : t("common.buttons.save")}
            </Button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={t("overviews.discardTitle")}
        description={t("overviews.discardDescription")}
        confirmLabel={t("overviews.discardAction")}
        onConfirm={finishCancel}
      />
    </>
  );
}
