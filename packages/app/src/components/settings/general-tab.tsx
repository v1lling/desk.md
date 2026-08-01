import { SettingsGroup, SettingsRow, SettingsSection } from "@/components/ui/settings-section";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Monitor, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  usePreferencesStore,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  type Language,
} from "@/stores/preferences";

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
    <div className="space-y-8">
      <SettingsSection
        title={t("settings.general.appearance.title")}
        description={t("settings.general.appearance.description")}
      >
        <SettingsGroup>
          <SettingsRow
            label={t("settings.general.theme.label")}
            description={t("settings.general.theme.description")}
          >
            <Select value={theme} onValueChange={handleThemeChange}>
              <SelectTrigger className="w-full sm:w-[160px]">
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
          </SettingsRow>

          <SettingsRow
            label={t("settings.general.language.label")}
            description={t("settings.general.language.description")}
          >
            <Select
              value={language}
              onValueChange={(v: Language) => setLanguage(v)}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
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
          </SettingsRow>

          <SettingsRow
            label={t("settings.general.compactSidebar.label")}
            description={t("settings.general.compactSidebar.description")}
          >
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
          </SettingsRow>
        </SettingsGroup>
      </SettingsSection>
    </div>
  );
}
