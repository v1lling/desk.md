import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useBootStore } from "@/stores/boot";
import { createNativeAuthClient } from "@/lib/native-auth-client";
import { nativeFetch } from "@/lib/native-http";
import { AuthScreen } from "./auth-screen";

/**
 * Native hosted-mode auth gate (step 3b-native) — the desktop counterpart of
 * [hosted-auth-gate.tsx]. Lazy-loaded in every non-hosted build (`!VITE_DESK_HOSTED`)
 * and rendered by the app-shell only inside a Tauri webview (isTauri()) when
 * `connectionMode === "remote"`, so the browser-mock build never shows it and local
 * mode never sees a login.
 *
 * Same three states as the web gate, but pointed at the user's chosen server and
 * authenticating with a Keychain bearer token instead of a same-origin cookie:
 *   loading        → spinner
 *   no session     → AuthScreen ("create" on a fresh server, else "login")
 *   authenticated  → the app shell (children)
 */
export default function NativeAuthGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const serverUrl = useBootStore((s) => s.serverUrl);
  // One client per server URL. Stable across renders so useSession is stable.
  const client = useMemo(() => createNativeAuthClient(serverUrl), [serverUrl]);
  const { data: session, isPending } = client.useSession();
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const base = serverUrl.replace(/\/$/, "");
    nativeFetch(`${base}/api/auth-status`)
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
  }, [serverUrl]);

  if (isPending || hasUsers === null) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t("common.buttons.loading")}</div>
      </div>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        mode={hasUsers ? "login" : "create"}
        auth={{ signIn: client.signIn, signUp: client.signUp }}
      />
    );
  }

  return <>{children}</>;
}
