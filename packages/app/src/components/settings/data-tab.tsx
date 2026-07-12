import { lazy, Suspense, useState } from "react";
import { SettingsSection } from "@/components/ui/settings-section";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FolderOpen, Loader2, CheckCircle2, FolderPlus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useBootStore } from "@/stores/boot";
import { usePreferencesStore } from "@/stores/preferences";
import { useNavigationStore } from "@/stores/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { isTauri, expandFsScope } from "@desk/core";
import { getDeskService } from "@desk/core";
import { isRemoteMode } from "@/lib/connection";
import type { Workspace } from "@desk/core/types";

// Hosted mode only: the account/sign-out section (and better-auth) is lazy-loaded
// behind the build flag, so the desktop bundle never includes it.
const HostedAccountSection = import.meta.env.VITE_DESK_HOSTED
  ? lazy(() => import("./hosted-account-section"))
  : null;

// Native hosted mode: the local/remote backend toggle. Bundled in every non-hosted
// build (constant `!VITE_DESK_HOSTED`, so the lean web build tree-shakes it out) and
// shown only inside a Tauri webview (isTauri(), checked at render).
const ConnectionSection = !import.meta.env.VITE_DESK_HOSTED
  ? lazy(() => import("./connection-section"))
  : null;

export function DataTab() {
  const { t } = useTranslation();
  const { dataPath, setDataPath, setSetupCompleted, reset: resetBoot } = useBootStore();
  // The local data folder is meaningless when connected to a remote server. Non-reactive
  // is fine: switching connection always reloads the app, so this component remounts.
  const remote = isRemoteMode();
  const { reset: resetPreferences } = usePreferencesStore();
  const { setCurrentWorkspaceId, reset: resetNavigation } = useNavigationStore();

  const queryClient = useQueryClient();

  // State for data path change dialog
  const [pendingPath, setPendingPath] = useState("");
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  const [isCheckingPath, setIsCheckingPath] = useState(false);
  const [foundWorkspaces, setFoundWorkspaces] = useState<Workspace[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetConfirm = () => {
    resetBoot();
    resetPreferences();
    resetNavigation();
    queryClient.invalidateQueries();
    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", systemDark);
    toast.success(t("toasts.settings.settingsReset"));
  };

  const handleCheckDataPath = async () => {
    if (!pendingPath.trim()) return;

    setIsCheckingPath(true);

    try {
      // Temporarily set the path so getWorkspaces knows where to look
      const oldPath = dataPath;
      setDataPath(pendingPath);

      if (isTauri()) {
        const existingWorkspaces = await getDeskService().getWorkspaces();
        setFoundWorkspaces(existingWorkspaces);
        setPathDialogOpen(true);
      } else {
        // In browser mode, just update the path
        queryClient.invalidateQueries();
        toast.success(t("toasts.settings.dataPathUpdated"));
      }

      // If dialog will open, restore old path until user confirms
      if (isTauri()) {
        setDataPath(oldPath);
      }
    } catch (error) {
      console.error("Error checking path:", error);
      setFoundWorkspaces([]);
      setPathDialogOpen(true);
    } finally {
      setIsCheckingPath(false);
    }
  };

  const handleConfirmPathChange = async (useExisting: boolean) => {
    setDataPath(pendingPath);
    if (isTauri()) {
      try {
        await expandFsScope(pendingPath);
      } catch (error) {
        console.error("Failed to update file scope for new data path:", error);
      }
    }
    queryClient.invalidateQueries();

    if (useExisting && foundWorkspaces.length > 0) {
      // Use first existing workspace
      setCurrentWorkspaceId(foundWorkspaces[0].id);
      toast.success(t("toasts.settings.switchedToPath", { path: pendingPath }));
    } else if (foundWorkspaces.length === 0) {
      // No workspaces found - trigger setup wizard for this path
      setSetupCompleted(false);
      toast.success(t("toasts.settings.dataPathUpdatedCreateWorkspace"));
    } else {
      // User wants to create new despite existing
      setSetupCompleted(false);
      toast.success(t("toasts.settings.dataPathUpdatedWizard"));
    }

    setPathDialogOpen(false);
    setPendingPath("");
    setFoundWorkspaces([]);
  };

  return (
    <div className="space-y-6">
      {/* Connection — local/remote backend toggle (native, non-hosted builds, Tauri only). */}
      {ConnectionSection && isTauri() && (
        <Suspense fallback={null}>
          <ConnectionSection />
        </Suspense>
      )}

      {/* Account — sign-out (hosted web build only). */}
      {HostedAccountSection && (
        <Suspense fallback={null}>
          <HostedAccountSection />
        </Suspense>
      )}

      {/* Data Storage — local mode only (a remote backend owns the data root). */}
      {!remote && (
        <SettingsSection
          icon={<FolderOpen className="h-4 w-4" />}
          title={t("settings.data.storage.title")}
          description={t("settings.data.storage.description")}
        >
          <div className="space-y-2">
            <Label htmlFor="data-path">{t("settings.data.storage.pathLabel")}</Label>
            <div className="flex gap-2">
              <Input
                id="data-path"
                value={pendingPath || dataPath}
                onChange={(e) => setPendingPath(e.target.value)}
                placeholder={t("settings.data.storage.pathPlaceholder")}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={handleCheckDataPath}
                disabled={isCheckingPath || !pendingPath.trim() || pendingPath === dataPath}
              >
                {isCheckingPath && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("settings.data.storage.change")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("settings.data.storage.helperText")}
            </p>
          </div>
        </SettingsSection>
      )}

      {/* Reset Settings */}
      <SettingsSection
        icon={<RotateCcw className="h-4 w-4" />}
        title={t("settings.data.reset.title")}
        description={t("settings.data.reset.description")}
      >
        <Button variant="destructive" onClick={() => setShowResetConfirm(true)}>
          {t("settings.data.reset.button")}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          {t("settings.data.reset.helperText")}
        </p>
      </SettingsSection>

      {/* Reset Settings Confirmation Dialog */}
      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title={t("settings.data.resetDialog.title")}
        description={t("settings.data.resetDialog.description")}
        confirmLabel={t("settings.data.resetDialog.confirmLabel")}
        variant="destructive"
        onConfirm={handleResetConfirm}
      />

      {/* Data Path Change Dialog */}
      <Dialog open={pathDialogOpen} onOpenChange={setPathDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            {foundWorkspaces.length > 0 ? (
              <>
                <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <DialogTitle>{t("settings.data.pathDialog.existingTitle")}</DialogTitle>
                <DialogDescription>
                  {t("settings.data.pathDialog.existingDescription", {
                    count: foundWorkspaces.length,
                  })}
                </DialogDescription>
              </>
            ) : (
              <>
                <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FolderPlus className="h-6 w-6 text-primary" />
                </div>
                <DialogTitle>{t("settings.data.pathDialog.emptyTitle")}</DialogTitle>
                <DialogDescription>
                  {t("settings.data.pathDialog.emptyDescription")}
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          {foundWorkspaces.length > 0 && (
            <div className="space-y-2 py-2">
              {foundWorkspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: workspace.color || "#3b82f6" }}
                  />
                  <div>
                    <p className="font-medium text-sm">{workspace.name}</p>
                    {workspace.description && (
                      <p className="text-xs text-muted-foreground">{workspace.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            {foundWorkspaces.length > 0 ? (
              <>
                <Button onClick={() => handleConfirmPathChange(true)}>
                  {t("settings.data.pathDialog.useExisting")}
                </Button>
                <Button variant="outline" onClick={() => handleConfirmPathChange(false)}>
                  {t("settings.data.pathDialog.startFresh")}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => handleConfirmPathChange(false)}>
                  {t("settings.data.pathDialog.continueToSetup")}
                </Button>
                <Button variant="outline" onClick={() => setPathDialogOpen(false)}>
                  {t("common.buttons.cancel")}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
