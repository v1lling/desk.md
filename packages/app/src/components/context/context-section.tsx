import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Compass, RefreshCw, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { describeAIError } from "@/lib/ai-error";
import { formatRelativeTime } from "@/lib/i18n/format";
import { SectionLabel, ListRow } from "@/components/patterns";
import { AIBadge } from "@/components/ui/ai-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useOpenTab } from "@/stores";
import { useCreateDocInFolder } from "@/stores/content";
import {
  useProjectContext,
  useEnsureProjectBrief,
  useRefreshState,
  useCanRunAI,
} from "@/stores/project-brief";
import { type BriefSeed } from "@desk/core";
import type { Project } from "@desk/core/types";
import { BriefSeedDialog } from "./brief-seed-dialog";

interface ContextSectionProps {
  project: Project;
}

/**
 * The orientation layer, mounted above the work on Project Home.
 *
 * Two files carry the map: the brief (the user's, AI never writes it) and the state file
 * (AI's, rewritten in the background as records change — see core desk/maintenance). The panel
 * shows both plus any hand-written context files, and whether the snapshot has drifted from
 * the records. The refresh normally runs itself; the icon-button exists for native-remote
 * (no watcher) and impatience.
 */
export function ContextSection({ project }: ContextSectionProps) {
  const { t } = useTranslation();
  const { openDoc } = useOpenTab();
  const workspaceId = project.workspaceId;
  const projectId = project.id;

  const { brief, state, others, contextDocs, records, freshness } = useProjectContext(
    workspaceId,
    projectId,
  );
  const canRunAI = useCanRunAI();

  const ensureBrief = useEnsureProjectBrief();
  const refreshState = useRefreshState();
  const createContextDoc = useCreateDocInFolder();

  const [seedOpen, setSeedOpen] = useState(false);
  const [newFileOpen, setNewFileOpen] = useState(false);

  const handleSeed = async (seed: BriefSeed) => {
    try {
      const doc = await ensureBrief.mutateAsync({
        workspaceId,
        projectId,
        projectName: project.name,
        seed,
      });
      openDoc(doc);
    } catch (err) {
      console.error("Failed to create brief:", err);
      toast.error(t("toasts.brief.create.error"));
    }
  };

  const handleRefresh = async () => {
    try {
      const result = await refreshState.mutateAsync({ workspaceId, projectId });
      if (result === "written") toast.success(t("toasts.state.refresh.success"));
    } catch (err) {
      console.error("Failed to refresh state:", err);
      // Surface the real cause (quota, invalid key, network) — without it, "could not refresh"
      // hides a billing problem behind a shrug. describeAIError localizes typed provider errors.
      toast.error(t("toasts.state.refresh.error"), {
        description: describeAIError(err, t),
      });
    }
  };

  const handleCreateContextFile = async (title: string) => {
    try {
      const doc = await createContextDoc.mutateAsync({
        scope: "project",
        title,
        workspaceId,
        projectId,
        kind: "context",
      });
      setNewFileOpen(false);
      openDoc(doc);
    } catch (err) {
      console.error("Failed to create context file:", err);
      toast.error(t("toasts.doc.createError"));
    }
  };

  const refreshButton = canRunAI ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void handleRefresh();
      }}
      disabled={refreshState.isPending || freshness.changedSince === 0}
      title={t("pages.projects.home.context.refreshState")}
      aria-label={t("pages.projects.home.context.refreshState")}
      className="text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
    >
      {refreshState.isPending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <RefreshCw className="size-3" />
      )}
    </button>
  ) : null;

  return (
    <section>
      <SectionLabel
        className="mb-1"
        end={
          <div className="flex items-center gap-2">
            <FreshnessPill freshness={freshness} />
            <button
              type="button"
              onClick={() => setNewFileOpen(true)}
              title={t("pages.projects.home.context.newContextFile")}
              aria-label={t("pages.projects.home.context.newContextFile")}
              className="text-muted-foreground/60 hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        }
      >
        {t("pages.projects.home.context.heading")}
      </SectionLabel>

      {contextDocs.length > 0 && (
        <div className="-mx-4">
          {brief && (
            <ListRow
              onClick={() => openDoc(brief)}
              leading={<Compass className="size-3.5 shrink-0 text-muted-foreground" />}
              title={brief.title}
            />
          )}
          {state && (
            <ListRow
              onClick={() => openDoc(state)}
              leading={<Compass className="size-3.5 shrink-0 text-muted-foreground/60" />}
              title={
                <>
                  {state.title}
                  <AIBadge className="ml-1.5 align-middle" />
                </>
              }
              meta={
                <>
                  {freshness.contextUpdated
                    ? t("pages.projects.home.context.reviewed", {
                        when: formatRelativeTime(freshness.contextUpdated),
                      })
                    : null}
                  {refreshButton}
                </>
              }
            />
          )}
          {others.map((doc) => (
            <ListRow
              key={doc.id}
              onClick={() => openDoc(doc)}
              leading={<Compass className="size-3.5 shrink-0 text-muted-foreground/60" />}
              title={doc.title}
            />
          ))}
        </div>
      )}

      {/* One quiet line per missing half of the map — no cards. The seed dialog carries the
          explanation; a project page does not need a billboard about an empty folder. */}
      {!brief && (
        <button
          type="button"
          onClick={() => setSeedOpen(true)}
          className="mt-1 block text-xs text-muted-foreground hover:text-foreground"
        >
          {t("pages.projects.home.context.writeBrief")}
        </button>
      )}
      {!state && records.length > 0 && canRunAI && (
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshState.isPending}
          className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          {refreshState.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Sparkles className="size-3" />
          )}
          {t("pages.projects.home.context.generateState")}
        </button>
      )}

      <BriefSeedDialog
        open={seedOpen}
        onClose={() => setSeedOpen(false)}
        defaultDescription={project.description ?? ""}
        onSubmit={handleSeed}
        isPending={ensureBrief.isPending}
      />

      <NewContextFileDialog
        open={newFileOpen}
        onClose={() => setNewFileOpen(false)}
        onSubmit={handleCreateContextFile}
        isPending={createContextDoc.isPending}
      />
    </section>
  );
}

/**
 * "Reviewed", never "verified": any save stamps `updated`, so this says when the state file was
 * last written relative to the records, not that its contents are true.
 */
function FreshnessPill({
  freshness,
}: {
  freshness: ReturnType<typeof useProjectContext>["freshness"];
}) {
  const { t } = useTranslation();
  if (freshness.status === "empty") return null;

  const label =
    freshness.status === "never"
      ? t("pages.projects.home.context.neverReviewed")
      : freshness.status === "stale"
        ? t("pages.projects.home.context.stale", { count: freshness.changedSince })
        : t("pages.projects.home.context.fresh");

  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-medium normal-case",
        freshness.status === "fresh"
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-500",
      )}
    >
      {label}
    </span>
  );
}

function NewContextFileDialog({
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (title: string) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setTitle("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("modals.newContextFile.title")}</DialogTitle>
        </DialogHeader>
        <FormField id="context-file-title" label={t("modals.newContextFile.nameLabel")}>
          <Input
            id="context-file-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
          />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.buttons.cancel")}
          </Button>
          <Button onClick={submit} disabled={!title.trim() || isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("modals.newContextFile.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
