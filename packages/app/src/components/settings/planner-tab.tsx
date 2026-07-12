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
import { Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePreferencesStore } from "@/stores/preferences";

export function PlannerTab() {
  const { t } = useTranslation();
  const {
    workDayStartHour,
    workDayEndHour,
    showWeekends,
    setWorkDayHours,
    setShowWeekends,
  } = usePreferencesStore();

  return (
    <div className="space-y-6">
      <SettingsSection
        icon={<Calendar className="h-4 w-4" />}
        title={t("settings.planner.title")}
        description={t("settings.planner.description")}
      >
        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label>{t("settings.planner.workDayStart.label")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.planner.workDayStart.description")}
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
              <Label>{t("settings.planner.workDayEnd.label")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.planner.workDayEnd.description")}
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
              <Label>{t("settings.planner.showWeekends.label")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.planner.showWeekends.description")}
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
