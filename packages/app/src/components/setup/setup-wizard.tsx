import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBootStore } from "@/stores/boot";
import { useNavigationStore } from "@/stores/navigation";
import { useCreateWorkspace } from "@/stores/workspaces";
import { initDeskDirectory, slugify, isTauri, needsTrafficLightPadding, expandFsScope } from "@desk/core";
import { getDeskService } from "@desk/core";
import { Loader2, FolderSearch, HardDrive, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeServerUrl } from "@/lib/server-url";
import type { Workspace } from "@desk/core/types";

type Step = "welcome" | "location" | "server-url" | "data-folder" | "existing-detected" | "workspace";

// Connecting to a remote server is a native-desktop capability: bundled in every
// non-hosted build (`!VITE_DESK_HOSTED`) but only offered inside a Tauri webview
// (isTauri()) — the browser-mock dev build stays local-only.
const SUPPORTS_REMOTE = !import.meta.env.VITE_DESK_HOSTED && isTauri();

const HOME_WORKSPACE_COLOR = "#6366f1";

export function SetupWizard() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("welcome");
  const [dataPath, setDataPath] = useState("~/Desk");
  const [workspaceName, setWorkspaceName] = useState("Personal");
  const [serverUrlInput, setServerUrlInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [existingWorkspaces, setExistingWorkspaces] = useState<Workspace[]>([]);
  const [hasTitleBarPadding, setHasTitleBarPadding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHasTitleBarPadding(needsTrafficLightPadding());
  }, []);

  const setSettingsDataPath = useBootStore((state) => state.setDataPath);
  const setSetupCompleted = useBootStore((state) => state.setSetupCompleted);
  const setConnection = useBootStore((state) => state.setConnection);
  const setCurrentWorkspaceId = useNavigationStore((state) => state.setCurrentWorkspaceId);
  const createWorkspace = useCreateWorkspace();

  const handleBrowseFolder = async () => {
    if (!isTauri()) return;

    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("setup.dataFolder.pickerTitle"),
      });

      if (selected && typeof selected === "string") {
        setDataPath(selected);
      }
    } catch (error) {
      console.error("Error opening folder picker:", error);
    }
  };

  const handleCheckDataFolder = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setSettingsDataPath(dataPath);
      await expandFsScope(dataPath);

      if (isTauri()) {
        const workspaces = await getDeskService().getWorkspaces();
        if (workspaces.length > 0) {
          setExistingWorkspaces(workspaces);
          setStep("existing-detected");
          return;
        }
      }

      setStep("workspace");
    } catch (err) {
      console.error("Error checking data folder:", err);
      if (isTauri()) {
        setError(t("errors.setup.checkDataFolder", { path: dataPath }));
        return;
      }
      setStep("workspace");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectServer = () => {
    const normalized = normalizeServerUrl(serverUrlInput);
    if (!normalized) {
      setError(
        /^http:\/\//i.test(serverUrlInput.trim())
          ? t("setup.server.httpsRequired")
          : t("setup.server.invalidUrl")
      );
      return;
    }
    // Switch to remote mode and reload: main.tsx wires RemoteDeskService and the
    // native auth gate takes over for login / first-run account creation.
    setConnection("remote", normalized);
    window.location.reload();
  };

  const handleUseExisting = () => {
    if (existingWorkspaces.length > 0) {
      setCurrentWorkspaceId(existingWorkspaces[0].id);
    }
    setSetupCompleted(true);
  };

  const handleFinish = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setSettingsDataPath(dataPath);
      await initDeskDirectory();

      const workspaceId = slugify(workspaceName);
      await createWorkspace.mutateAsync({
        id: workspaceId,
        name: workspaceName.trim(),
        color: HOME_WORKSPACE_COLOR,
        home: true,
      });

      setCurrentWorkspaceId(workspaceId);
      setSetupCompleted(true);
    } catch (err) {
      console.error("Setup failed:", err);
      if (isTauri()) {
        setError(t("errors.setup.createDataFolder", { path: dataPath }));
        return;
      }
      const workspaceId = slugify(workspaceName);
      setCurrentWorkspaceId(workspaceId);
      setSetupCompleted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {hasTitleBarPadding && <div data-tauri-drag-region className="h-7 shrink-0" />}
      <main className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-md flex flex-col items-center gap-10">
          {step === "welcome" && (
            <div className="flex flex-col items-center text-center gap-6">
              <img
                src="/icon.png"
                alt="Desk"
                width={64}
                height={64}
                className="rounded-xl"
              />
              <div className="flex flex-col gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{t("setup.welcome.title")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("setup.welcome.subtitle")}
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => setStep(SUPPORTS_REMOTE ? "location" : "data-folder")}
              >
                {t("common.buttons.continue")}
              </Button>
            </div>
          )}

          {step === "location" && (
            <div className="w-full flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center">
                <h1 className="text-base font-semibold tracking-tight">{t("setup.location.title")}</h1>
                <p className="text-sm text-muted-foreground">{t("setup.location.subtitle")}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setStep("data-folder")}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 text-left hover:border-foreground/30 hover:bg-muted/40 transition-colors"
                >
                  <HardDrive className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t("setup.location.localTitle")}</p>
                    <p className="text-sm text-muted-foreground">{t("setup.location.localDescription")}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setStep("server-url")}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 text-left hover:border-foreground/30 hover:bg-muted/40 transition-colors"
                >
                  <Server className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t("setup.location.remoteTitle")}</p>
                    <p className="text-sm text-muted-foreground">{t("setup.location.remoteDescription")}</p>
                  </div>
                </button>
              </div>
              <Button variant="outline" onClick={() => setStep("welcome")}>
                {t("common.buttons.back")}
              </Button>
            </div>
          )}

          {step === "server-url" && (
            <div className="w-full flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center">
                <h1 className="text-base font-semibold tracking-tight">{t("setup.server.title")}</h1>
                <p className="text-sm text-muted-foreground">{t("setup.server.subtitle")}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="serverUrl">{t("setup.server.label")}</Label>
                <Input
                  id="serverUrl"
                  value={serverUrlInput}
                  onChange={(e) => {
                    setServerUrlInput(e.target.value);
                    setError(null);
                  }}
                  placeholder="https://nas.example"
                />
                <p className="text-xs text-muted-foreground">{t("setup.server.hint")}</p>
              </div>
              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("location")} disabled={isLoading}>
                  {t("common.buttons.back")}
                </Button>
                <Button className="flex-1" onClick={handleConnectServer} disabled={!serverUrlInput.trim()}>
                  {t("setup.server.connect")}
                </Button>
              </div>
            </div>
          )}

          {step === "data-folder" && (
            <div className="w-full flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center">
                <h1 className="text-base font-semibold tracking-tight">{t("setup.dataFolder.title")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("setup.dataFolder.subtitle")}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dataPath">{t("setup.dataFolder.label")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="dataPath"
                    value={dataPath}
                    onChange={(e) => {
                      setDataPath(e.target.value);
                      setError(null);
                    }}
                    placeholder="~/Desk"
                    className="flex-1"
                  />
                  {isTauri() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleBrowseFolder}
                      title={t("setup.dataFolder.browseTitle")}
                    >
                      <FolderSearch className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(SUPPORTS_REMOTE ? "location" : "welcome")}
                  disabled={isLoading}
                >
                  {t("common.buttons.back")}
                </Button>
                <Button className="flex-1" onClick={handleCheckDataFolder} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("common.buttons.continue")}
                </Button>
              </div>
            </div>
          )}

          {step === "existing-detected" && (
            <div className="w-full flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center">
                <h1 className="text-base font-semibold tracking-tight">{t("setup.existingDetected.title")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("setup.existingDetected.description", { count: existingWorkspaces.length })}
                </p>
              </div>
              <ul className="flex flex-col gap-1.5">
                {existingWorkspaces.map((workspace) => (
                  <li
                    key={workspace.id}
                    className="flex items-center gap-3 rounded-md border border-border/60 bg-card px-3 py-2"
                  >
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: workspace.color || HOME_WORKSPACE_COLOR }}
                    />
                    <span className="text-sm font-medium truncate">{workspace.name}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2">
                <Button className="w-full" onClick={handleUseExisting}>
                  {t("setup.existingDetected.useExisting")}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setStep("workspace")}>
                  {t("setup.existingDetected.startFresh")}
                </Button>
              </div>
            </div>
          )}

          {step === "workspace" && (
            <div className="w-full flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center">
                <h1 className="text-base font-semibold tracking-tight">{t("setup.workspace.title")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("setup.workspace.subtitle")}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="workspaceName">{t("setup.workspace.nameLabel")}</Label>
                <Input
                  id="workspaceName"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder={t("setup.workspace.namePlaceholder")}
                />
              </div>
              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    existingWorkspaces.length > 0 ? setStep("existing-detected") : setStep("data-folder")
                  }
                  disabled={isLoading}
                >
                  {t("common.buttons.back")}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleFinish}
                  disabled={!workspaceName.trim() || isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("setup.workspace.finish")}
                </Button>
              </div>
            </div>
          )}

          <ProgressDots step={step} />
        </div>
      </main>
    </div>
  );
}

function ProgressDots({ step }: { step: Step }) {
  const index = step === "welcome" ? 0 : step === "workspace" ? 2 : 1;
  return (
    <div className="flex gap-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "size-1.5 rounded-full transition-colors",
            i === index ? "bg-foreground/70" : "bg-foreground/15",
          )}
        />
      ))}
    </div>
  );
}
