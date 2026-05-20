
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBootStore } from "@/stores/boot";
import { useNavigationStore } from "@/stores/navigation";
import { useCreateWorkspace } from "@/stores/workspaces";
import { initDeskDirectory, slugify, getWorkspaces, isTauri, needsTrafficLightPadding, expandFsScope } from "@/lib/desk";
import { FolderOpen, Palette, Loader2, CheckCircle2, FolderSearch } from "lucide-react";
import type { Workspace } from "@/types";

type Step = "welcome" | "data-folder" | "existing-detected" | "workspace";

const COLORS = [
  "#6366f1", // indigo
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

export function SetupWizard() {
  const [step, setStep] = useState<Step>("welcome");
  const [dataPath, setDataPath] = useState("~/Desk");
  const [workspaceName, setWorkspaceName] = useState("Personal");
  const [workspaceColor, setWorkspaceColor] = useState(COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [existingWorkspaces, setExistingWorkspaces] = useState<Workspace[]>([]);
  const [hasTitleBarPadding, setHasTitleBarPadding] = useState(false);

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

    try {
      // Save the data path first so getWorkspaces knows where to look
      setSettingsDataPath(dataPath);

      // Expand FS scope to the new data path before any file operations
      await expandFsScope(dataPath);

      // Only check for existing workspaces in Tauri mode
      if (isTauri()) {
        const workspaces = await getWorkspaces();
        if (workspaces.length > 0) {
          setExistingWorkspaces(workspaces);
          setStep("existing-detected");
          return;
        }
      }

      // No existing data, proceed to set up the home workspace
      setStep("workspace");
    } catch (error) {
      console.error("Error checking data folder:", error);
      setStep("workspace");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseExisting = () => {
    // Use the first existing workspace as the current one
    if (existingWorkspaces.length > 0) {
      setCurrentWorkspaceId(existingWorkspaces[0].id);
    }
    setSetupCompleted(true);
  };

  const handleFinish = async () => {
    setIsLoading(true);

    try {
      // Save settings
      setSettingsDataPath(dataPath);

      // Initialize the Desk directory structure
      await initDeskDirectory();

      // Create the home workspace
      const workspaceId = slugify(workspaceName);
      await createWorkspace.mutateAsync({
        id: workspaceId,
        name: workspaceName.trim(),
        color: workspaceColor,
        home: true,
      });

      setCurrentWorkspaceId(workspaceId);
      setSetupCompleted(true);
    } catch (error) {
      console.error("Setup failed:", error);
      // In browser mode, still complete setup
      const workspaceId = slugify(workspaceName);
      setCurrentWorkspaceId(workspaceId);
      setSetupCompleted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col">
      {/* Draggable title bar region for macOS */}
      {hasTitleBarPadding && (
        <div data-tauri-drag-region className="h-7 shrink-0" />
      )}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-lg">
        {step === "welcome" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                <img
                  src="/icon.png"
                  alt="Desk"
                  width={80}
                  height={80}
                  className="rounded-xl"
                />
              </div>
              <CardTitle className="text-2xl">Welcome to Desk</CardTitle>
              <CardDescription>
                Your projects, tasks, docs, and meetings — as plain Markdown files you own.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Organize your work into <strong>workspaces</strong> and projects.
                Everything stays on your machine as plain Markdown files — yours
                to keep, edit anywhere, and never locked in.
              </p>
              <Button className="w-full" onClick={() => setStep("data-folder")}>
                Get Started
              </Button>
            </CardContent>
          </>
        )}

        {step === "data-folder" && (
          <>
            <CardHeader>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FolderOpen className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Choose Data Location</CardTitle>
              <CardDescription>
                Where should Desk store your projects and tasks?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dataPath">Data Folder</Label>
                <div className="flex gap-2">
                  <Input
                    id="dataPath"
                    value={dataPath}
                    onChange={(e) => setDataPath(e.target.value)}
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
                <p className="text-xs text-muted-foreground">
                  Your workspaces, projects, and notes will be stored here as markdown files.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("welcome")} disabled={isLoading}>
                  Back
                </Button>
                <Button className="flex-1" onClick={handleCheckDataFolder} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {step === "existing-detected" && (
          <>
            <CardHeader>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <CardTitle>Existing Data Found</CardTitle>
              <CardDescription>
                We found {existingWorkspaces.length} existing workspace{existingWorkspaces.length > 1 ? "s" : ""} in this folder.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {existingWorkspaces.map((workspace) => (
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
              <div className="flex flex-col gap-2">
                <Button className="w-full" onClick={handleUseExisting}>
                  Use Existing Data
                </Button>
                <Button variant="outline" onClick={() => setStep("workspace")}>
                  Create New Workspace Instead
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {step === "workspace" && (
          <>
            <CardHeader>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Palette className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Your home workspace</CardTitle>
              <CardDescription>
                Workspaces keep separate areas of work apart. This is your home
                workspace — name it anything (your name, &ldquo;Personal&rdquo;,
                &ldquo;Home&rdquo;…). You can add more later for clients, side
                projects, or other areas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspaceName">Workspace Name</Label>
                <Input
                  id="workspaceName"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g., Personal, Home"
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full transition-all ${
                        workspaceColor === color
                          ? "ring-2 ring-offset-2 ring-primary"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setWorkspaceColor(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => existingWorkspaces.length > 0 ? setStep("existing-detected") : setStep("data-folder")}
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
                  Get Started
                </Button>
              </div>
            </CardContent>
          </>
        )}
        </Card>
      </div>
    </div>
  );
}
