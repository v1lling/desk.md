import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBootStore } from "@/stores/boot";
import { useNavigationStore } from "@/stores/navigation";
import { useCreateWorkspace } from "@/stores/workspaces";
import { initDeskDirectory, slugify, getWorkspaces, isTauri, needsTrafficLightPadding, expandFsScope } from "@/lib/desk";
import { Loader2, FolderSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/types";

type Step = "welcome" | "data-folder" | "existing-detected" | "workspace";

const HOME_WORKSPACE_COLOR = "#6366f1";

export function SetupWizard() {
  const [step, setStep] = useState<Step>("welcome");
  const [dataPath, setDataPath] = useState("~/Desk");
  const [workspaceName, setWorkspaceName] = useState("Personal");
  const [isLoading, setIsLoading] = useState(false);
  const [existingWorkspaces, setExistingWorkspaces] = useState<Workspace[]>([]);
  const [hasTitleBarPadding, setHasTitleBarPadding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHasTitleBarPadding(needsTrafficLightPadding());
  }, []);

  const setSettingsDataPath = useBootStore((state) => state.setDataPath);
  const setSetupCompleted = useBootStore((state) => state.setSetupCompleted);
  const setCurrentWorkspaceId = useNavigationStore((state) => state.setCurrentWorkspaceId);
  const createWorkspace = useCreateWorkspace();

  const handleBrowseFolder = async () => {
    if (!isTauri()) return;

    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Data Folder",
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
        const workspaces = await getWorkspaces();
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
        setError(
          `Couldn't access "${dataPath}". Check that the folder path is valid and that Desk can write there, then try again.`
        );
        return;
      }
      setStep("workspace");
    } finally {
      setIsLoading(false);
    }
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
        setError(
          `Setup couldn't create your data folder at "${dataPath}". Make sure the location exists and Desk has permission to write there, then try again.`
        );
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
                <h1 className="text-xl font-semibold tracking-tight">Welcome to Desk.</h1>
                <p className="text-sm text-muted-foreground">
                  Your projects, tasks, docs, and meetings, as plain Markdown files you own.
                </p>
              </div>
              <Button className="w-full" onClick={() => setStep("data-folder")}>
                Continue
              </Button>
            </div>
          )}

          {step === "data-folder" && (
            <div className="w-full flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center">
                <h1 className="text-base font-semibold tracking-tight">Where should we store your files?</h1>
                <p className="text-sm text-muted-foreground">
                  Pick any folder. Desk creates the structure for you, and you can move it later.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dataPath">Data folder</Label>
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
                      title="Browse for folder"
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
                <Button variant="outline" onClick={() => setStep("welcome")} disabled={isLoading}>
                  Back
                </Button>
                <Button className="flex-1" onClick={handleCheckDataFolder} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === "existing-detected" && (
            <div className="w-full flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center">
                <h1 className="text-base font-semibold tracking-tight">You already have Desk data here.</h1>
                <p className="text-sm text-muted-foreground">
                  Found {existingWorkspaces.length} workspace{existingWorkspaces.length > 1 ? "s" : ""} in this folder.
                  Continue where you left off, or start fresh.
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
                  Use existing data
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setStep("workspace")}>
                  Start fresh
                </Button>
              </div>
            </div>
          )}

          {step === "workspace" && (
            <div className="w-full flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center">
                <h1 className="text-base font-semibold tracking-tight">Name your workspace.</h1>
                <p className="text-sm text-muted-foreground">
                  This is your home, for personal notes and the capture inbox. Add more workspaces later for clients,
                  projects, or other areas.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="workspaceName">Name</Label>
                <Input
                  id="workspaceName"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Personal"
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
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleFinish}
                  disabled={!workspaceName.trim() || isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Finish
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
