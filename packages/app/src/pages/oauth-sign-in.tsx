import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthScreen } from "@/components/auth/auth-screen";

/**
 * OAuth login page (hosted-web only) — the `loginPage` the OAuth AS redirects an
 * unauthenticated authorize request to (see packages/server/src/auth.ts). It reuses the
 * standard AuthScreen, but instead of reloading on success it RESUMES the authorization
 * flow: once the same-origin session cookie is set, POST /oauth2/continue with the signed
 * query (carried in this page's URL) and follow the returned redirect — to the consent
 * page, or straight back to the connector if consent is skipped.
 *
 * Mounted outside the auth gate (see app.tsx) so the AS can land here pre-session.
 */
export default function OAuthSignIn() {
  const { t } = useTranslation();
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth-status")
      .then((r) => r.json())
      .then((d: { hasUsers?: boolean }) => {
        if (active) setHasUsers(!!d.hasUsers);
      })
      // Fail safe: assume an account exists → show login, never an open create screen.
      .catch(() => {
        if (active) setHasUsers(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Resume the OAuth flow after the session is established. The signed authorize query is
  // this page's own query string; the provider's continue endpoint hands back where to go next.
  const resume = async () => {
    const res = await fetch("/api/auth/oauth2/continue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ postLogin: true, oauth_query: window.location.search.slice(1) }),
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string };
    if (!res.ok || !data.url) {
      throw new Error("oauth_continue_failed");
    }
    window.location.href = data.url;
  };

  if (hasUsers === null) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t("common.buttons.loading")}</div>
      </div>
    );
  }

  return <AuthScreen mode={hasUsers ? "login" : "create"} onSuccess={resume} />;
}
