import { SettingsGroup, SettingsRow, SettingsSection } from "@/components/ui/settings-section";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <div className="space-y-8">
      <SettingsSection
        title={t("settings.planner.schedule.title")}
        description={t("settings.planner.schedule.description")}
      >
        <SettingsGroup>
          <SettingsRow
            label={t("settings.planner.workDayStart.label")}
            description={t("settings.planner.workDayStart.description")}
          >
            <Select
              value={String(workDayStartHour)}
              onValueChange={(v) => {
                const start = Number(v);
                if (start >= workDayEndHour) return;
                setWorkDayHours(start, workDayEndHour);
              }}
            >
              <SelectTrigger className="w-full sm:w-[120px]">
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
          </SettingsRow>

          <SettingsRow
            label={t("settings.planner.workDayEnd.label")}
            description={t("settings.planner.workDayEnd.description")}
          >
            <Select
              value={String(workDayEndHour)}
              onValueChange={(v) => {
                const end = Number(v);
                if (end <= workDayStartHour) return;
                setWorkDayHours(workDayStartHour, end);
              }}
            >
              <SelectTrigger className="w-full sm:w-[120px]">
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
          </SettingsRow>

          <SettingsRow
            label={t("settings.planner.showWeekends.label")}
            description={t("settings.planner.showWeekends.description")}
          >
            <Switch
              checked={showWeekends}
              onCheckedChange={setShowWeekends}
            />
          </SettingsRow>
        </SettingsGroup>
      </SettingsSection>
    </div>
  );
}
