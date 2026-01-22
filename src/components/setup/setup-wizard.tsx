"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettingsStore } from "@/stores/settings";
import { useCreateWorkspace } from "@/stores/workspaces";
import { initOrbitDirectory, slugify, getWorkspaces, isTauri, needsTrafficLightPadding } from "@/lib/orbit";
import { Rocket, FolderOpen, Palette, Loader2, CheckCircle2 } from "lucide-react";
import type { Workspace } from "@/types";

type Step = "welcome" | "data-folder" | "existing-detected" | "first-workspace";

const COLORS = [
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
  const [dataPath, setDataPath] = useState("~/Orbit");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceColor, setWorkspaceColor] = useState(COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [existingWorkspaces, setExistingWorkspaces] = useState<Workspace[]>([]);
  const [hasTitleBarPadding, setHasTitleBarPadding] = useState(false);

  useEffect(() => {
    setHasTitleBarPadding(needsTrafficLightPadding());
  }, []);

  const setSettingsDataPath = useSettingsStore((state) => state.setDataPath);
  const setSetupCompleted = useSettingsStore((state) => state.setSetupCompleted);
  const setCurrentWorkspaceId = useSettingsStore((state) => state.setCurrentWorkspaceId);
  const createWorkspace = useCreateWorkspace();

  const handleCheckDataFolder = async () => {
    setIsLoading(true);

    try {
      // Save the data path first so getWorkspaces knows where to look
      setSettingsDataPath(dataPath);

      // Only check for existing workspaces in Tauri mode
      if (isTauri()) {
        const workspaces = await getWorkspaces();
        if (workspaces.length > 0) {
          setExistingWorkspaces(workspaces);
          setStep("existing-detected");
          return;
        }
      }

      // No existing data, proceed to create first workspace
      setStep("first-workspace");
    } catch (error) {
      console.error("Error checking data folder:", error);
      setStep("first-workspace");
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

  const handleCreateNew = async () => {
    setIsLoading(true);

    try {
      // Save settings
      setSettingsDataPath(dataPath);

      // Initialize the Orbit directory structure
      await initOrbitDirectory();

      // Create the first workspace
      const workspaceId = slugify(workspaceName);
      await createWorkspace.mutateAsync({
        id: workspaceId,
        name: workspaceName,
        color: workspaceColor,
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
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Welcome to Orbit</CardTitle>
              <CardDescription>
                Project-centric work management for freelancers and consultants.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Orbit organizes your work around <strong>projects</strong>, not notes.
                Everything lives in portable markdown files.
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
                Where should Orbit store your projects and tasks?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dataPath">Data Folder</Label>
                <Input
                  id="dataPath"
                  value={dataPath}
                  onChange={(e) => setDataPath(e.target.value)}
                  placeholder="~/Orbit"
                />
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
                <Button variant="outline" onClick={() => setStep("first-workspace")}>
                  Create New Workspace Instead
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {step === "first-workspace" && (
          <>
            <CardHeader>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Palette className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Create Your First Workspace</CardTitle>
              <CardDescription>
                Workspaces separate your clients or projects. Start with one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspaceName">Workspace Name</Label>
                <Input
                  id="workspaceName"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g., ACME Corp, Personal, Freelance"
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
                  onClick={handleCreateNew}
                  disabled={!workspaceName.trim() || isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Workspace
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
