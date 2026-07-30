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
import type { SummaryDetail } from "@desk/core";
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
import { useAIMaintenanceSettingsStore } from "@/stores/ai-maintenance-settings";
import { useSmartIndexMaintenance } from "@/hooks/use-smart-index-maintenance";
import { formatRelativeTime } from "./smart-index-utils";

export function SmartIndexSection() {
  const { t } = useTranslation();
  const {
    autoSummarizeOnSave,
    setAutoSummarizeOnSave,
    summaryDetail,
    setSummaryDetail,
    providerType,
  } = useAIMaintenanceSettingsStore();
  const {
    aiKeyConfigured,
    remote,
    canBuild,
    totalIndexFiles,
    summarizedCount,
    pendingCount,
    workspaceRows,
    isBuilding,
    lastResult,
    indexProgress,
    indexResult,
    showClearConfirm,
    setShowClearConfirm,
    buildIndex,
    clearCatalog,
  } = useSmartIndexMaintenance(providerType);

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
                onClick={buildIndex}
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
              {canBuild && !remote && <p>{t("settings.smartIndex.info.offlineChanges")}</p>}
              {remote && <p>{t("settings.smartIndex.info.serverSide")}</p>}
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
        onConfirm={clearCatalog}
      />
    </>
  );
}
