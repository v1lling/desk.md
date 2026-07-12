import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsSection } from "@/components/ui/settings-section";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { signOut } from "@/lib/auth-client";

/**
 * Hosted-mode "Account" settings (step 3b) — lazy-loaded behind the
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
      icon={<LogOut className="h-4 w-4" />}
      title={t("auth.account.title")}
      description={t("auth.account.description")}
    >
      <div className="flex items-center justify-between py-3">
        <div className="space-y-0.5">
          <Label>{t("auth.account.signOutLabel")}</Label>
          <p className="text-sm text-muted-foreground">{t("auth.account.signOutDescription")}</p>
        </div>
        <Button variant="outline" onClick={handleSignOut}>
          {t("auth.signOut")}
        </Button>
      </div>
    </SettingsSection>
  );
}
