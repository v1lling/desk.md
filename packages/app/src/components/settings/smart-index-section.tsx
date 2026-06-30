import { useState } from "react";
import { SettingsSection } from "@/components/ui/settings-section";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { SummaryDetail } from "@/lib/context-index/constants";
import {
  Loader2,
  AlertCircle,
  FileText,
  RefreshCw,
  Trash2,
  Database,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useContextStore } from "@/stores/context";
import { useContextIndexStore } from "@/stores/context-index";
import { useAISettingsStore } from "@/stores/ai";
import { ensureAIConsent } from "@/stores/ai-consent";
import { useWorkspaces } from "@/stores";
import { buildWorkspaceIndex } from "@/lib/context-index/builder";
import { writeWorkspaceContextArtifact } from "@/lib/context-index/artifacts";
import {
  writePerWorkspaceAgentFiles,
  writeTopLevelAgentFiles,
  deleteGeneratedAgentFiles,
} from "@/lib/context-index/agent-context";
import { getDeskService, isTauri } from "@desk/core";
import type { BuildIndexProgress, BuildIndexResult } from "@/lib/context-index/types";
import { formatRelativeTime } from "./context-tab-utils";

export function SmartIndexSection() {
  const { t } = useTranslation();
  const {
    autoSummarizeOnSave,
    setAutoSummarizeOnSave,
    summaryDetail,
    setSummaryDetail,
  } = useContextStore();

  // True when the active provider has an API key saved. Without one, the catalog still
  // builds with full metadata — files just have no AI summary until a key is added.
  const aiKeyConfigured = useAISettingsStore(
    (s) => s.providerConfigured[s.providerType]
  );

  // The Smart Index is built client-side using the locally stored AI key (OS Keychain),
  // so it only runs in the desktop app — including native-remote, which indexes the
  // server's files with the local key. In the browser (hosted web) there's no Keychain,
  // so building would silently no-op; disable the controls and explain instead.
  const canBuild = isTauri();

  const { indexes, setIndex, isBuilding, setIsBuilding, lastResult, setLastResult } =
    useContextIndexStore();
  const { data: workspaces = [] } = useWorkspaces();

  const [indexProgress, setIndexProgress] = useState<BuildIndexProgress | null>(null);
  const [indexResult, setIndexResult] = useState<BuildIndexResult | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const allEntries = Object.values(indexes).flatMap((idx) => idx.entries);
  const totalIndexFiles = allEntries.length;
  // Every file is in the catalog; `summary` is the optional AI enrichment. Coverage =
  // how many files have an AI summary vs still pending (no key, or not yet summarized).
  const summarizedCount = allEntries.filter((e) => e.summary).length;
  const pendingCount = totalIndexFiles - summarizedCount;

  // Per-workspace rows: file count + when last touched (background auto-summary OR rebuild).
  const workspaceRows = Object.values(indexes)
    .map((idx) => ({
      id: idx.workspaceId,
      name: idx.workspaceName,
      fileCount: idx.fileCount,
      updatedAt: idx.updatedAt ?? idx.builtAt,
      color: workspaces.find((w) => w.id === idx.workspaceId)?.color ?? "#6366f1",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleBuildIndex = async () => {
    // Privacy gate: only when a provider key is configured does the build send
    // file previews externally. A keyless build is local-only — no consent needed.
    if (aiKeyConfigured && !(await ensureAIConsent())) return;

    setIsBuilding(true);
    setIndexProgress(null);
    setIndexResult(null);

    try {
      let accumulatedResult: BuildIndexResult | null = null;

      for (const workspace of workspaces) {
        const existingIndex = indexes[workspace.id];
        const { index, result } = await buildWorkspaceIndex(
          workspace.id,
          workspace.name,
          existingIndex,
          setIndexProgress
        );
        setIndex(workspace.id, index);
        await writeWorkspaceContextArtifact(index);
        // Refresh per-workspace agent files (project list may have changed)
        getDeskService().getProjects(workspace.id).then((projects) =>
          writePerWorkspaceAgentFiles(workspace.id, workspace, projects)
        ).catch(() => {});

        if (!accumulatedResult) {
          accumulatedResult = result;
        } else {
          accumulatedResult = {
            totalFiles: accumulatedResult.totalFiles + result.totalFiles,
            summarized: accumulatedResult.summarized + result.summarized,
            reused: accumulatedResult.reused + result.reused,
            excluded: accumulatedResult.excluded + result.excluded,
            errors: [...accumulatedResult.errors, ...result.errors],
          };
        }
      }

      if (accumulatedResult) {
        setIndexResult(accumulatedResult);
        setLastResult({ ...accumulatedResult, at: new Date().toISOString() });
        toast.success(
          t("toasts.settings.indexBuilt", {
            files: accumulatedResult.totalFiles,
            workspaces: workspaces.length,
          }),
        );
        // Refresh top-level agent files
        writeTopLevelAgentFiles(workspaces).catch(() => {});
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("errors.settings.indexBuildFailed", { message }));
    } finally {
      setIsBuilding(false);
      setIndexProgress(null);
    }
  };

  // Wipe everything: empty the Smart Index and delete the generated
  // CLAUDE.md / AGENTS.md / GEMINI.md / WORKSPACE_CONTEXT.md files from disk.
  const handleClearCatalog = async () => {
    for (const workspace of workspaces) {
      useContextIndexStore.getState().removeIndex(workspace.id);
    }
    setIndexResult(null);
    setLastResult(null);
    try {
      await deleteGeneratedAgentFiles(workspaces);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("errors.settings.catalogClearedPartial", { message }));
      setShowClearConfirm(false);
      return;
    }
    toast.success(t("toasts.settings.catalogCleared"));
    setShowClearConfirm(false);
  };

  return (
    <>
      <SettingsSection
        icon={<Database className="h-4 w-4" />}
        title={t("settings.smartIndex.status.title")}
        description={t("settings.smartIndex.status.description")}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-semibold">{totalIndexFiles}</p>
                <p className="text-xs text-muted-foreground">{t("settings.smartIndex.status.filesIndexed")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {pendingCount > 0
                    ? t("settings.smartIndex.status.coveragePartial", {
                        summarized: summarizedCount,
                        total: totalIndexFiles,
                      })
                    : t("settings.smartIndex.status.coverageComplete", { count: summarizedCount })}
                </p>
                <p className="text-xs text-muted-foreground">{t("settings.smartIndex.status.coverage")}</p>
              </div>
            </div>
          </div>

          {workspaceRows.length > 0 && (
            <div className="divide-y divide-border/40 rounded-lg border">
              {workspaceRows.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="truncate text-sm font-medium">{row.name}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    <span>{t("settings.smartIndex.status.workspaceFiles", { count: row.fileCount })}</span>
                    <span>{t("settings.smartIndex.status.updatedAgo", { time: formatRelativeTime(row.updatedAt, t) })}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBuildIndex}
                disabled={isBuilding || !canBuild}
              >
                {isBuilding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {t("settings.smartIndex.actions.rebuild")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowClearConfirm(true)}
                disabled={isBuilding || !canBuild}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("settings.smartIndex.actions.clear")}
              </Button>
            </div>

            {indexProgress && indexProgress.phase === "summarizing" && (
              <div className="text-sm text-muted-foreground">
                {t("settings.smartIndex.progress.summarizing", {
                  workspace: indexProgress.currentWorkspace,
                  processed: indexProgress.processed,
                  total: indexProgress.total,
                })}
              </div>
            )}
            {indexProgress && indexProgress.phase === "collecting" && (
              <div className="text-sm text-muted-foreground">
                {t("settings.smartIndex.progress.collecting")}
              </div>
            )}

            {indexResult && indexResult.errors.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-sm font-medium text-destructive">
                    {t("settings.smartIndex.errors.title", { count: indexResult.errors.length })}
                  </span>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {indexResult.errors.slice(0, 10).map((error, idx) => (
                    <p key={idx} className="text-xs text-destructive/90 font-mono break-all">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {!isBuilding && lastResult && (
              <div className="text-sm text-muted-foreground">
                {lastResult.excluded > 0
                  ? t("settings.smartIndex.results.lastRebuildWithExcluded", {
                      time: formatRelativeTime(lastResult.at, t),
                      summarized: lastResult.summarized,
                      reused: lastResult.reused,
                      excluded: lastResult.excluded,
                    })
                  : t("settings.smartIndex.results.lastRebuild", {
                      time: formatRelativeTime(lastResult.at, t),
                      summarized: lastResult.summarized,
                      reused: lastResult.reused,
                    })}
              </div>
            )}

            <div className="mt-2 space-y-1 rounded-lg border p-3 text-sm text-muted-foreground">
              <p>{t("settings.smartIndex.info.oneCatalog")}</p>
              {canBuild && <p>{t("settings.smartIndex.info.incremental")}</p>}
              {canBuild && <p>{t("settings.smartIndex.info.offlineChanges")}</p>}
              {!canBuild ? (
                <p>{t("settings.smartIndex.info.desktopOnly")}</p>
              ) : (
                !aiKeyConfigured && <p>{t("settings.smartIndex.info.noProvider")}</p>
              )}
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={<SlidersHorizontal className="h-4 w-4" />}
        title={t("settings.smartIndex.config.title")}
        description={t("settings.smartIndex.config.description")}
      >
        <div className="flex items-center justify-between py-3">
          <div className="space-y-0.5">
            <Label>{t("settings.smartIndex.autoSummarize.label")}</Label>
            <p className="text-sm text-muted-foreground">
              {t("settings.smartIndex.autoSummarize.description")}
            </p>
          </div>
          <Switch
            checked={autoSummarizeOnSave}
            onCheckedChange={(checked) => {
              setAutoSummarizeOnSave(checked);
              toast.success(
                checked
                  ? t("toasts.settings.autoSummarizeEnabled")
                  : t("toasts.settings.autoSummarizeDisabled"),
              );
            }}
          />
        </div>
        {autoSummarizeOnSave && aiKeyConfigured && (
          <p className="pb-3 text-xs text-amber-600 dark:text-amber-400">
            {t("settings.smartIndex.autoSummarize.activeWarning")}
          </p>
        )}

        <div className="flex items-center justify-between py-3 border-t border-border/40">
          <div className="space-y-0.5 pr-4">
            <Label>{t("settings.smartIndex.detail.label")}</Label>
            <p className="text-sm text-muted-foreground">
              {t("settings.smartIndex.detail.description")}
            </p>
          </div>
          <Select
            value={summaryDetail}
            onValueChange={(v) => setSummaryDetail(v as SummaryDetail)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="brief">{t("settings.smartIndex.detail.options.brief")}</SelectItem>
              <SelectItem value="standard">{t("settings.smartIndex.detail.options.standard")}</SelectItem>
              <SelectItem value="detailed">{t("settings.smartIndex.detail.options.detailed")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </SettingsSection>

      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title={t("settings.smartIndex.clearDialog.title")}
        description={t("settings.smartIndex.clearDialog.description")}
        confirmLabel={t("settings.smartIndex.clearDialog.confirmLabel")}
        variant="destructive"
        onConfirm={handleClearCatalog}
      />
    </>
  );
}
