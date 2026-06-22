import { SettingsSection } from "@/components/ui/settings-section";
import { Button } from "@/components/ui/button";
import { Info, ExternalLink, FileText, Bug, Github, Scale } from "lucide-react";
import { open as openShell } from "@tauri-apps/plugin-shell";
import { useTranslation } from "react-i18next";
import { UpdateSection } from "./update-section";
import { isTauri } from "@desk/core";
import { formatLocaleDate } from "@/lib/i18n/format";

const REPO_URL = "https://github.com/v1lling/desk.md";

function openExternal(url: string) {
  if (isTauri()) {
    void openShell(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function formatBuildTime(iso: string): string {
  return formatLocaleDate(iso, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface LinkRowProps {
  icon: React.ReactNode;
  label: string;
  href: string;
}

function LinkRow({ icon, label, href }: LinkRowProps) {
  return (
    <button
      type="button"
      onClick={() => openExternal(href)}
      className="w-full flex items-center justify-between py-2 text-sm hover:text-foreground text-foreground/80 transition-colors group"
    >
      <span className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </span>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

export function AboutTab() {
  const { t } = useTranslation();
  const version = __APP_VERSION__;
  const commit = __GIT_COMMIT__;
  const buildTime = __BUILD_TIME__;

  return (
    <div className="space-y-6">
      <SettingsSection
        icon={<Info className="h-4 w-4" />}
        title={t("settings.about.app.title")}
        description={t("settings.about.app.description")}
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">{t("settings.about.app.version")}</dt>
          <dd className="font-mono">{version}</dd>
          <dt className="text-muted-foreground">{t("settings.about.app.commit")}</dt>
          <dd className="font-mono">{commit}</dd>
          <dt className="text-muted-foreground">{t("settings.about.app.built")}</dt>
          <dd>{formatBuildTime(buildTime)}</dd>
        </dl>
      </SettingsSection>

      <UpdateSection />

      <SettingsSection
        icon={<ExternalLink className="h-4 w-4" />}
        title={t("settings.about.links.title")}
        description={t("settings.about.links.description")}
      >
        <div className="divide-y divide-border/40">
          <LinkRow
            icon={<FileText className="h-3.5 w-3.5" />}
            label={t("settings.about.links.releaseNotes", { version })}
            href={`${REPO_URL}/releases/tag/v${version}`}
          />
          <LinkRow
            icon={<FileText className="h-3.5 w-3.5" />}
            label={t("settings.about.links.allReleases")}
            href={`${REPO_URL}/releases`}
          />
          <LinkRow
            icon={<Github className="h-3.5 w-3.5" />}
            label={t("settings.about.links.viewOnGithub")}
            href={REPO_URL}
          />
          <LinkRow
            icon={<Bug className="h-3.5 w-3.5" />}
            label={t("settings.about.links.reportIssue")}
            href={`${REPO_URL}/issues/new`}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        icon={<Scale className="h-4 w-4" />}
        title={t("settings.about.license.title")}
        description={t("settings.about.license.description")}
      >
        <div className="flex items-center justify-between py-1 text-sm">
          {/* eslint-disable-next-line i18next/no-literal-string -- SPDX license identifier, not translatable */}
          <span className="font-mono text-foreground/80">GPL-3.0-or-later</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openExternal(`${REPO_URL}/blob/main/LICENSE`)}
          >
            {t("settings.about.license.viewLicense")}
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}
