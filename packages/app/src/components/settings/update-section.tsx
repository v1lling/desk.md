import { SettingsSection } from "@/components/ui/settings-section";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUpdateChecker } from "@/hooks/use-update-checker";
import { isTauri } from "@desk/core";

export function UpdateSection() {
  const { t } = useTranslation();
  const { status, updateInfo, error, checkForUpdate, downloadAndInstall, dismiss } = useUpdateChecker();

  // Don't render in browser mode
  if (!isTauri()) return null;

  return (
    <SettingsSection
      icon={<Download className="h-4 w-4" />}
      title={t("settings.about.updates.title")}
      description={t("settings.about.updates.description")}
    >
      <div className="space-y-3">
        {status === "idle" && !error && (
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <p className="text-sm">{t("settings.about.updates.noUpdates")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.about.updates.onLatest")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => checkForUpdate(true)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t("settings.about.updates.check")}
            </Button>
          </div>
        )}

        {status === "checking" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("settings.about.updates.checking")}
          </div>
        )}

        {status === "available" && updateInfo && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-medium">
                {t("settings.about.updates.versionAvailable", { version: updateInfo.version })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={downloadAndInstall}>
                {t("settings.about.updates.updateAndRestart")}
              </Button>
              <Button variant="ghost" size="sm" onClick={dismiss}>
                {t("settings.about.updates.skipThisVersion")}
              </Button>
            </div>
          </div>
        )}

        {status === "downloading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("settings.about.updates.downloading")}
          </div>
        )}

        {status === "error" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error || t("settings.about.updates.checkFailed")}
            </div>
            <Button variant="outline" size="sm" onClick={() => checkForUpdate(true)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t("common.buttons.retry")}
            </Button>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
