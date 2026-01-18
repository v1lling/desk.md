"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { useSettingsStore } from "@/stores/settings";
import { useAreas } from "@/stores/areas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { FolderOpen, Palette, Monitor, Sun, Moon, RotateCcw, Loader2, CheckCircle2, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getAreas, isTauri } from "@/lib/orbit";
import type { Area } from "@/types";

export default function SettingsPage() {
  const {
    dataPath,
    theme,
    sidebarCollapsed,
    setDataPath,
    setTheme,
    setSidebarCollapsed,
    setCurrentAreaId,
    setSetupCompleted,
    reset,
  } = useSettingsStore();

  const queryClient = useQueryClient();
  const { data: areas = [] } = useAreas();

  // State for data path change dialog
  const [pendingPath, setPendingPath] = useState("");
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  const [isCheckingPath, setIsCheckingPath] = useState(false);
  const [foundAreas, setFoundAreas] = useState<Area[]>([]);

  const handleCheckDataPath = async () => {
    if (!pendingPath.trim()) return;

    setIsCheckingPath(true);

    try {
      // Temporarily set the path so getAreas knows where to look
      const oldPath = dataPath;
      setDataPath(pendingPath);

      if (isTauri()) {
        const existingAreas = await getAreas();
        setFoundAreas(existingAreas);
        setPathDialogOpen(true);
      } else {
        // In browser mode, just update the path
        queryClient.invalidateQueries();
        toast.success("Data path updated");
      }

      // If dialog will open, restore old path until user confirms
      if (isTauri()) {
        setDataPath(oldPath);
      }
    } catch (error) {
      console.error("Error checking path:", error);
      setFoundAreas([]);
      setPathDialogOpen(true);
    } finally {
      setIsCheckingPath(false);
    }
  };

  const handleConfirmPathChange = (useExisting: boolean) => {
    setDataPath(pendingPath);
    queryClient.invalidateQueries();

    if (useExisting && foundAreas.length > 0) {
      // Use first existing area
      setCurrentAreaId(foundAreas[0].id);
      toast.success(`Switched to ${pendingPath} with existing data`);
    } else if (foundAreas.length === 0) {
      // No areas found - trigger setup wizard for this path
      setSetupCompleted(false);
      toast.success("Data path updated. Create your first area.");
    } else {
      // User wants to create new despite existing
      setSetupCompleted(false);
      toast.success("Data path updated. Setup wizard will guide you.");
    }

    setPathDialogOpen(false);
    setPendingPath("");
    setFoundAreas([]);
  };

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);

    // Apply theme to document
    const root = document.documentElement;
    if (newTheme === "system") {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", systemDark);
    } else {
      root.classList.toggle("dark", newTheme === "dark");
    }

    toast.success(`Theme set to ${newTheme}`);
  };

  const handleResetSettings = () => {
    if (confirm("Are you sure you want to reset all settings to defaults? This will show the setup wizard again.")) {
      reset();
      // Invalidate all queries
      queryClient.invalidateQueries();
      // Apply system theme
      const root = document.documentElement;
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", systemDark);
      toast.success("Settings reset to defaults");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Settings" />

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize how Orbit looks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Select your preferred color scheme
                  </p>
                </div>
                <Select value={theme} onValueChange={handleThemeChange}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <span className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        Light
                      </span>
                    </SelectItem>
                    <SelectItem value="dark">
                      <span className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        Dark
                      </span>
                    </SelectItem>
                    <SelectItem value="system">
                      <span className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        System
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Compact sidebar</Label>
                  <p className="text-sm text-muted-foreground">
                    Show only icons in the sidebar
                  </p>
                </div>
                <Switch
                  checked={sidebarCollapsed}
                  onCheckedChange={(checked) => {
                    setSidebarCollapsed(checked);
                    toast.success(checked ? "Sidebar collapsed" : "Sidebar expanded");
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Data Storage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Data Storage
              </CardTitle>
              <CardDescription>
                Where your projects and files are stored
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="data-path">Data folder path</Label>
                <div className="flex gap-2">
                  <Input
                    id="data-path"
                    value={pendingPath || dataPath}
                    onChange={(e) => setPendingPath(e.target.value)}
                    placeholder="~/Orbit"
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={handleCheckDataPath}
                    disabled={isCheckingPath || !pendingPath.trim() || pendingPath === dataPath}
                  >
                    {isCheckingPath && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Change
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  All your areas, projects, tasks, and notes are stored as markdown files in this folder.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Areas Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Areas</CardTitle>
              <CardDescription>
                Your configured work areas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {areas.length === 0 ? (
                <p className="text-sm text-muted-foreground">No areas configured yet.</p>
              ) : (
                <div className="space-y-2">
                  {areas.map((area) => (
                    <div
                      key={area.id}
                      className="flex items-center gap-3 p-2 rounded-md border"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: area.color || "#6366f1" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{area.name}</p>
                        {area.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {area.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Reset
              </CardTitle>
              <CardDescription>
                Reset application settings to defaults
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleResetSettings}>
                Reset All Settings
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                This will reset all settings and show the setup wizard again. Your data files will not be deleted.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Data Path Change Dialog */}
      <Dialog open={pathDialogOpen} onOpenChange={setPathDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            {foundAreas.length > 0 ? (
              <>
                <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <DialogTitle>Existing Data Found</DialogTitle>
                <DialogDescription>
                  Found {foundAreas.length} area{foundAreas.length > 1 ? "s" : ""} at this location.
                </DialogDescription>
              </>
            ) : (
              <>
                <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FolderPlus className="h-6 w-6 text-primary" />
                </div>
                <DialogTitle>Empty Location</DialogTitle>
                <DialogDescription>
                  No Orbit data found at this path. You&apos;ll need to create your first area.
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          {foundAreas.length > 0 && (
            <div className="space-y-2 py-2">
              {foundAreas.map((area) => (
                <div
                  key={area.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: area.color || "#3b82f6" }}
                  />
                  <div>
                    <p className="font-medium text-sm">{area.name}</p>
                    {area.description && (
                      <p className="text-xs text-muted-foreground">{area.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            {foundAreas.length > 0 ? (
              <>
                <Button onClick={() => handleConfirmPathChange(true)}>
                  Use Existing Data
                </Button>
                <Button variant="outline" onClick={() => handleConfirmPathChange(false)}>
                  Start Fresh Instead
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => handleConfirmPathChange(false)}>
                  Continue to Setup
                </Button>
                <Button variant="outline" onClick={() => setPathDialogOpen(false)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
