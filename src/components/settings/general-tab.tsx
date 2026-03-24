import { SettingsSection } from "@/components/ui/settings-section";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Palette, Monitor, Sun, Moon, Calendar } from "lucide-react";
import { toast } from "sonner";
import { UpdateSection } from "./update-section";
import {
  usePreferencesStore,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
} from "@/stores/preferences";

export function GeneralTab() {
  const {
    theme,
    sidebarWidth,
    workDayStartHour,
    workDayEndHour,
    showWeekends,
    setTheme,
    setSidebarWidth,
    setWorkDayHours,
    setShowWeekends,
  } = usePreferencesStore();

  const isCollapsed = sidebarWidth <= SIDEBAR_COLLAPSED_WIDTH;

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

  return (
    <div className="space-y-6">
      {/* Updates */}
      <UpdateSection />

      {/* Appearance */}
      <SettingsSection
        icon={<Palette className="h-4 w-4" />}
        title="Appearance"
        description="Customize how Desk looks"
      >
        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between py-3">
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

          <div className="flex items-center justify-between py-3">
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
        </div>
      </SettingsSection>

      {/* Planner */}
      <SettingsSection
        icon={<Calendar className="h-4 w-4" />}
        title="Planner"
        description="Configure your weekly planner"
      >
        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label>Work day start</Label>
              <p className="text-sm text-muted-foreground">
                When your work day begins
              </p>
            </div>
            <Select
              value={String(workDayStartHour)}
              onValueChange={(v) => {
                const start = Number(v);
                if (start >= workDayEndHour) return;
                setWorkDayHours(start, workDayEndHour);
              }}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 17 }, (_, i) => i + 5).map((h) => (
                  <SelectItem key={h} value={String(h)} disabled={h >= workDayEndHour}>
                    {`${h}:00`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label>Work day end</Label>
              <p className="text-sm text-muted-foreground">
                When your work day ends
              </p>
            </div>
            <Select
              value={String(workDayEndHour)}
              onValueChange={(v) => {
                const end = Number(v);
                if (end <= workDayStartHour) return;
                setWorkDayHours(workDayStartHour, end);
              }}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
                  <SelectItem key={h} value={String(h)} disabled={h <= workDayStartHour}>
                    {`${h}:00`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label>Show weekends</Label>
              <p className="text-sm text-muted-foreground">
                Include Saturday and Sunday in the week view
              </p>
            </div>
            <Switch
              checked={showWeekends}
              onCheckedChange={setShowWeekends}
            />
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
