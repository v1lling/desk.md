import { useTranslation } from "react-i18next";
import { SettingsGroup, SettingsRow, SettingsSection } from "@/components/ui/settings-section";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

/**
 * Hosted-mode "Account" settings — lazy-loaded behind the
 * VITE_DESK_HOSTED flag so better-auth never enters the desktop bundle. Just a
 * sign-out for now; the local Tauri app never renders this.
 */
export default function HostedAccountSection() {
  const { t } = useTranslation();

  const handleSignOut = async () => {
    await signOut();
    // Reload so the app-shell gate re-evaluates and shows the login screen.
    window.location.reload();
  };

  return (
    <SettingsSection
      title={t("auth.account.title")}
      description={t("auth.account.description")}
    >
      <SettingsGroup>
        <SettingsRow
          label={t("auth.account.signOutLabel")}
          description={t("auth.account.signOutDescription")}
        >
        <Button variant="outline" onClick={handleSignOut}>
          {t("auth.signOut")}
        </Button>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>
  );
}
