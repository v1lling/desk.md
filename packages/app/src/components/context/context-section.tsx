import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Compass, RefreshCw, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/i18n/format";
import { SectionLabel, ListRow } from "@/components/patterns";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useOpenTab } from "@/stores";
import {
  useProjectContext,
  useEnsureProjectBrief,
  useRefreshBrief,
  useApplyBrief,
  useCanRunAI,
  buildRefreshPromptText,
} from "@/stores/project-brief";
import { type BriefSeed, type SectionMergeResult } from "@desk/core";
import type { Project } from "@desk/core/types";
import { BriefSeedDialog } from "./brief-seed-dialog";
import { RefreshPreviewDialog } from "./refresh-preview-dialog";

interface ContextSectionProps {
  project: Project;
}

/**
 * The orientation layer, mounted above the work on Project Home.
 *
 * Shows the brief, the other context files, and whether the map has drifted from the records.
 * When there is no brief, the whole panel becomes the call to action to write one — which is the
 * only thing standing between `context/` and the fate of `ai-docs/`, an empty folder nobody
 * could see a reason to fill.
 */
export function ContextSection({ project }: ContextSectionProps) {
  const { t } = useTranslation();
  const { openDoc } = useOpenTab();
  const workspaceId = project.workspaceId;
  const projectId = project.id;

  // `records` is the changed-since set the model reconciles against — the same list the
  // freshness count is derived from, so the pill and the payload always agree.
  const { brief, others, contextDocs, records, freshness } = useProjectContext(
    workspaceId,
    projectId,
  );
  const canRunAI = useCanRunAI();

  const ensureBrief = useEnsureProjectBrief();
  const refreshBrief = useRefreshBrief();
  const applyBrief = useApplyBrief();

  const [seedOpen, setSeedOpen] = useState(false);
  const [preview, setPreview] = useState<SectionMergeResult | null>(null);

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
    if (!brief) return;
    try {
      const result = await refreshBrief.mutateAsync({ brief, records });
      setPreview(result);
    } catch (err) {
      console.error("Failed to refresh brief:", err);
      toast.error(t("toasts.brief.refresh.error"));
    }
  };

  const handleCopyPrompt = async () => {
    if (!brief) return;
    await navigator.clipboard.writeText(buildRefreshPromptText(brief, records));
    toast.success(t("toasts.brief.promptCopied"));
  };

  // Rethrows on failure: the dialog closes itself only once the write lands, so a failed write
  // leaves the reviewed merge on screen to retry rather than discarding it behind a toast.
  const handleApply = async (content: string) => {
    if (!brief) return;
    try {
      await applyBrief.mutateAsync({ brief, content });
      toast.success(t("toasts.brief.refresh.success"));
    } catch (err) {
      console.error("Failed to apply brief:", err);
      toast.error(t("toasts.brief.apply.error"));
      throw err;
    }
  };

  return (
    <section>
      <SectionLabel
        className="mb-1"
        end={
          contextDocs.length > 0 ? (
            <div className="flex items-center gap-2">
              <FreshnessPill freshness={freshness} />
              {!brief ? null : canRunAI ? (
                <button
                  type="button"
                  onClick={handleRefresh}
                  // Nothing has changed since the brief was written, so there is nothing to
                  // reconcile. A refresh here would just burn tokens to restate the file.
                  disabled={refreshBrief.isPending || freshness.changedSince === 0}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
                >
                  {refreshBrief.isPending ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3" />
                  )}
                  {t("pages.projects.home.context.refresh")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  title={t("pages.projects.home.context.copyPromptHint")}
                >
                  <Copy className="size-3" />
                  {t("pages.projects.home.context.copyPrompt")}
                </button>
              )}
            </div>
          ) : undefined
        }
      >
        {t("pages.projects.home.context.heading")}
      </SectionLabel>

      {/*
        The context files are always listed, brief or not. A project can hold hand-written
        context files without a canonical brief (every project migrated from `ai-docs/` does),
        and showing "no brief yet" while hiding them would tell the user their map is empty
        when it is not.
      */}
      {contextDocs.length > 0 && (
        <div className="-mx-4">
          {brief && (
            <ListRow
              onClick={() => openDoc(brief)}
              leading={<Compass className="size-3.5 shrink-0 text-muted-foreground" />}
              title={brief.title}
              meta={
                freshness.contextUpdated
                  ? t("pages.projects.home.context.reviewed", {
                      when: formatRelativeTime(freshness.contextUpdated),
                    })
                  : undefined
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

      {!brief &&
        (contextDocs.length === 0 ? (
          <EmptyState
            display="inline"
            className="py-6"
            icon={Compass}
            title={t("emptyStates.brief.title")}
            description={t("emptyStates.brief.description")}
            action={
              <Button size="sm" variant="outline" onClick={() => setSeedOpen(true)}>
                {t("emptyStates.brief.action")}
              </Button>
            }
          />
        ) : (
          // Context exists but no brief anchors it. A quieter nudge than the full empty state.
          <button
            type="button"
            onClick={() => setSeedOpen(true)}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {t("pages.projects.home.context.addBrief")}
          </button>
        ))}

      <BriefSeedDialog
        open={seedOpen}
        onClose={() => setSeedOpen(false)}
        defaultDescription={project.description ?? ""}
        onSubmit={handleSeed}
        isPending={ensureBrief.isPending}
      />

      <RefreshPreviewDialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        originalBody={brief?.content ?? ""}
        result={preview}
        onApply={handleApply}
        onRetry={handleRefresh}
        isApplying={applyBrief.isPending}
        isRefreshing={refreshBrief.isPending}
      />
    </section>
  );
}

/**
 * "Reviewed", never "verified": any save stamps `updated`, so this says when the brief was last
 * touched relative to the records, not that its contents are true.
 */
function FreshnessPill({
  freshness,
}: {
  freshness: ReturnType<typeof useProjectContext>["freshness"];
}) {
  const { t } = useTranslation();
  if (freshness.status === "empty") return null;

  const stale = freshness.status === "stale";
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-medium normal-case",
        stale
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-500"
          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      )}
    >
      {stale
        ? t("pages.projects.home.context.stale", { count: freshness.changedSince })
        : t("pages.projects.home.context.fresh")}
    </span>
  );
}
