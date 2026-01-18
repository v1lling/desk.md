"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettingsStore } from "@/stores/settings";
import { useCreateArea } from "@/stores/areas";
import { initOrbitDirectory, slugify } from "@/lib/orbit";
import { Rocket, FolderOpen, Palette, Loader2 } from "lucide-react";

type Step = "welcome" | "data-folder" | "first-area" | "complete";

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
  const [areaName, setAreaName] = useState("");
  const [areaColor, setAreaColor] = useState(COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  const setSettingsDataPath = useSettingsStore((state) => state.setDataPath);
  const setSetupCompleted = useSettingsStore((state) => state.setSetupCompleted);
  const setCurrentAreaId = useSettingsStore((state) => state.setCurrentAreaId);
  const createArea = useCreateArea();

  const handleComplete = async () => {
    setIsCreating(true);

    try {
      // Save settings
      setSettingsDataPath(dataPath);

      // Initialize the Orbit directory structure
      await initOrbitDirectory();

      // Create the first area
      const areaId = slugify(areaName);
      await createArea.mutateAsync({
        id: areaId,
        name: areaName,
        color: areaColor,
      });

      setCurrentAreaId(areaId);
      setSetupCompleted(true);
    } catch (error) {
      console.error("Setup failed:", error);
      // In browser mode, still complete setup
      const areaId = slugify(areaName);
      setCurrentAreaId(areaId);
      setSetupCompleted(true);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-8">
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
                  Your areas, projects, and notes will be stored here as markdown files.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("welcome")}>
                  Back
                </Button>
                <Button className="flex-1" onClick={() => setStep("first-area")}>
                  Continue
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {step === "first-area" && (
          <>
            <CardHeader>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Palette className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Create Your First Area</CardTitle>
              <CardDescription>
                Areas separate your clients or workspaces. Start with one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="areaName">Area Name</Label>
                <Input
                  id="areaName"
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
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
                        areaColor === color
                          ? "ring-2 ring-offset-2 ring-primary"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setAreaColor(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("data-folder")} disabled={isCreating}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleComplete}
                  disabled={!areaName.trim() || isCreating}
                >
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Area
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
