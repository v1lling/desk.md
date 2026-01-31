"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Palette, Monitor, Sun, Moon, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  useSettingsStore,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
} from "@/stores/settings";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function GeneralTab() {
  const {
    theme,
    sidebarWidth,
    setTheme,
    setSidebarWidth,
    reset,
  } = useSettingsStore();

  const queryClient = useQueryClient();
  const isCollapsed = sidebarWidth <= SIDEBAR_COLLAPSED_WIDTH;
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const handleResetConfirm = () => {
    reset();
    queryClient.invalidateQueries();
    // Apply system theme
    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", systemDark);
    toast.success("Settings reset to defaults");
  };

  return (
    <div className="space-y-4">
      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize how Desk looks
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
                Show only icons in the sidebar (or drag the edge to resize)
              </p>
            </div>
            <Switch
              checked={isCollapsed}
              onCheckedChange={(checked) => {
                setSidebarWidth(checked ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_DEFAULT_WIDTH);
                toast.success(checked ? "Sidebar collapsed" : "Sidebar expanded");
              }}
            />
          </div>
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
          <Button variant="destructive" onClick={handleResetClick}>
            Reset All Settings
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            This will reset all settings and show the setup wizard again. Your data files will not be deleted.
          </p>
        </CardContent>
      </Card>

      {/* Reset Settings Confirmation Dialog */}
      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Reset All Settings"
        description="Are you sure you want to reset all settings to defaults? This will show the setup wizard again. Your data files will not be deleted."
        confirmLabel="Reset"
        variant="destructive"
        onConfirm={handleResetConfirm}
      />
    </div>
  );
}
