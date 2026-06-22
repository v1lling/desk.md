import { lazy, Suspense } from "react";
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
import { Palette, Monitor, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  usePreferencesStore,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  type Language,
} from "@/stores/preferences";

// Hosted mode only: the account/sign-out section (and better-auth) is lazy-loaded
// behind the build flag, so the desktop bundle never includes it.
const HostedAccountSection = import.meta.env.VITE_DESK_HOSTED
  ? lazy(() => import("./hosted-account-section"))
  : null;

export function GeneralTab() {
  const { t } = useTranslation();
  const {
    theme,
    language,
    sidebarWidth,
    setTheme,
    setLanguage,
    setSidebarWidth,
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

    toast.success(t("toasts.settings.themeSet", { theme: t(`settings.general.theme.options.${newTheme}`) }));
  };

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <SettingsSection
        icon={<Palette className="h-4 w-4" />}
        title={t("settings.general.appearance.title")}
        description={t("settings.general.appearance.description")}
      >
        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label>{t("settings.general.theme.label")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.general.theme.description")}
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
                    {t("settings.general.theme.options.light")}
                  </span>
                </SelectItem>
                <SelectItem value="dark">
                  <span className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    {t("settings.general.theme.options.dark")}
                  </span>
                </SelectItem>
                <SelectItem value="system">
                  <span className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    {t("settings.general.theme.options.system")}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label>{t("settings.general.language.label")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.general.language.description")}
              </p>
            </div>
            <Select
              value={language}
              onValueChange={(v: Language) => setLanguage(v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">
                  {t("settings.general.language.options.en")}
                </SelectItem>
                <SelectItem value="de">
                  {t("settings.general.language.options.de")}
                </SelectItem>
                <SelectItem value="fr">
                  {t("settings.general.language.options.fr")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label>{t("settings.general.compactSidebar.label")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.general.compactSidebar.description")}
              </p>
            </div>
            <Switch
              checked={isCollapsed}
              onCheckedChange={(checked) => {
                setSidebarWidth(checked ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_DEFAULT_WIDTH);
                toast.success(
                  checked
                    ? t("toasts.settings.sidebarCollapsed")
                    : t("toasts.settings.sidebarExpanded"),
                );
              }}
            />
          </div>
        </div>
      </SettingsSection>

      {HostedAccountSection && (
        <Suspense fallback={null}>
          <HostedAccountSection />
        </Suspense>
      )}
    </div>
  );
}
