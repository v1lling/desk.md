import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * OAuth consent page (hosted-web only) — the `consentPage` the OAuth AS redirects to once
 * the user is authenticated (see packages/server/src/auth.ts). It shows which app
 * (Claude/ChatGPT/etc.) is asking and for what, then approves or denies.
 *
 * The signed authorize query rides in this page's URL. We read client_id + scope from it,
 * fetch the app's display name, and on a decision POST /oauth2/consent with the full signed
 * query; the provider returns where to send the user back (the connector callback with a code).
 *
 * Mounted outside the auth gate (see app.tsx); the user already has a session by this point.
 */
export default function OAuthConsent() {
  const { t } = useTranslation();
  const [appName, setAppName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams(window.location.search);
  const scopes = (params.get("scope") ?? "").split(" ").filter(Boolean);

  /** Friendly label for a requested OAuth scope; falls back to the raw scope string. */
  const scopeLabel = (scope: string): string => {
    switch (scope) {
      case "openid":
        return t("auth.consent.scopes.openid");
      case "profile":
        return t("auth.consent.scopes.profile");
      case "email":
        return t("auth.consent.scopes.email");
      case "offline_access":
        return t("auth.consent.scopes.offline_access");
      default:
        return scope;
    }
  };

  useEffect(() => {
    const clientId = params.get("client_id");
    if (!clientId) {
      setError(t("auth.consent.error"));
      setLoading(false);
      return;
    }
    let active = true;
    fetch(`/api/auth/oauth2/public-client?client_id=${encodeURIComponent(clientId)}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { client_name?: string }) => {
        if (active) setAppName(d.client_name || clientId);
      })
      .catch(() => {
        if (active) setAppName(clientId);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decide = async (accept: boolean) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accept, oauth_query: window.location.search.slice(1) }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (!res.ok || !data.url) throw new Error("consent_failed");
      window.location.href = data.url;
    } catch {
      setError(t("auth.consent.error"));
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t("common.buttons.loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-sm flex flex-col gap-6">
          <div className="flex flex-col items-center text-center gap-4">
            <img src="/icon.png" alt="Desk" width={56} height={56} className="rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <h1 className="text-lg font-semibold tracking-tight">
                {t("auth.consent.title", { app: appName ?? t("auth.consent.unknownApp") })}
              </h1>
              <p className="text-sm text-muted-foreground">{t("auth.consent.subtitle")}</p>
            </div>
          </div>

          {scopes.length > 0 && (
            <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                {t("auth.consent.scopesTitle")}
              </p>
              <ul className="flex flex-col gap-1">
                {scopes.map((s) => (
                  <li key={s} className="text-sm">
                    {scopeLabel(s)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => decide(false)} disabled={submitting}>
              {t("auth.consent.deny")}
            </Button>
            <Button className="flex-1" onClick={() => decide(true)} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("auth.consent.allow")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
