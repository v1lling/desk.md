import { useState } from "react";
import { HardDrive, Server, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsSection } from "@/components/ui/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBootStore } from "@/stores/boot";
import { createNativeAuthClient } from "@/lib/native-auth-client";
import { clearSessionToken } from "@/lib/session-token";
import { normalizeServerUrl } from "@/lib/server-url";

/**
 * Native hosted-mode "Connection" settings (step 3b-native) — lazy-loaded in every
 * non-hosted build (gated on `!VITE_DESK_HOSTED`) and rendered only inside a Tauri
 * webview (isTauri()). Lets the desktop app switch between local disk and a remote
 * desk.md server.
 *
 * Switching is reload-based (the service is wired at boot in main.tsx). Switching to
 * local never asks for credentials and never touches the local data folder, so the
 * user is never trapped behind a login.
 */
export default function ConnectionSection() {
  const { t } = useTranslation();
  const connectionMode = useBootStore((s) => s.connectionMode);
  const serverUrl = useBootStore((s) => s.serverUrl);
  const dataPath = useBootStore((s) => s.dataPath);
  const setConnection = useBootStore((s) => s.setConnection);

  const [showConnect, setShowConnect] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleConnect = () => {
    const normalized = normalizeServerUrl(urlInput);
    if (!normalized) {
      setError(
        /^http:\/\//i.test(urlInput.trim())
          ? t("settings.data.connection.httpsRequired")
          : t("settings.data.connection.invalidUrl")
      );
      return;
    }
    // Remote mode + reload → main.tsx wires RemoteDeskService and the native gate
    // shows login/create against the new server.
    setConnection("remote", normalized);
    window.location.reload();
  };

  const handleSwitchToLocal = async () => {
    setBusy(true);
    await clearSessionToken();
    setConnection("local");
    window.location.reload();
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await createNativeAuthClient(serverUrl).signOut();
    } catch {
      // Even if the server call fails, drop the local token so the gate shows login.
    }
    await clearSessionToken();
    window.location.reload();
  };

  if (connectionMode === "remote") {
    return (
      <SettingsSection
        icon={<Server className="h-4 w-4" />}
        title={t("settings.data.connection.title")}
        description={t("settings.data.connection.description")}
      >
        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5 min-w-0">
              <Label>{t("settings.data.connection.remoteLabel")}</Label>
              <p className="text-sm text-muted-foreground truncate">{serverUrl}</p>
            </div>
            <Button variant="outline" onClick={handleSignOut} disabled={busy}>
              <LogOut className="mr-2 h-4 w-4" />
              {t("auth.signOut")}
            </Button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label>{t("settings.data.connection.switchToLocalLabel")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.data.connection.switchToLocalDescription")}
              </p>
            </div>
            <Button variant="outline" onClick={handleSwitchToLocal} disabled={busy}>
              <HardDrive className="mr-2 h-4 w-4" />
              {t("settings.data.connection.switchToLocal")}
            </Button>
          </div>
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      icon={<HardDrive className="h-4 w-4" />}
      title={t("settings.data.connection.title")}
      description={t("settings.data.connection.description")}
    >
      <div className="divide-y divide-border/40">
        <div className="flex items-center justify-between py-3">
          <div className="space-y-0.5 min-w-0">
            <Label>{t("settings.data.connection.localLabel")}</Label>
            <p className="text-sm text-muted-foreground truncate">{dataPath}</p>
          </div>
          {!showConnect && (
            <Button variant="outline" onClick={() => setShowConnect(true)}>
              <Server className="mr-2 h-4 w-4" />
              {t("settings.data.connection.connectToServer")}
            </Button>
          )}
        </div>
        {showConnect && (
          <div className="py-3 space-y-2">
            <Label htmlFor="serverUrl">{t("settings.data.connection.serverUrlLabel")}</Label>
            <div className="flex gap-2">
              <Input
                id="serverUrl"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  setError(null);
                }}
                placeholder="https://nas.example"
                className="flex-1"
              />
              <Button onClick={handleConnect} disabled={busy || !urlInput.trim()}>
                {t("settings.data.connection.connect")}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              {t("settings.data.connection.connectHint")}
            </p>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
