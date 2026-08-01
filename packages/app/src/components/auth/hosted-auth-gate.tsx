import { useEffect, useState, type ReactNode } from "react";
import { signIn, signUp, useSession } from "@/lib/auth-client";
import { AuthScreen } from "./auth-screen";
import { AppBootScreen } from "@/app/boot-screen";

/**
 * Hosted-mode auth gate — lazy-loaded, so better-auth never enters the
 * Tauri / browser-fixture bundles (see app-shell). Three states mirroring the local
 * setup-wizard flow:
 *   loading            → branded boot surface
 *   no session         → AuthScreen ("create account" on a fresh deployment where
 *                        no user exists yet, otherwise "login")
 *   authenticated      → the app shell (children)
 */
export default function HostedAuthGate({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth-status")
      .then((r) => r.json())
      .then((d: { hasUsers?: boolean }) => {
        if (active) setHasUsers(!!d.hasUsers);
      })
      // Fail safe: assume an account exists, so we show login (never an open
      // create-account screen) if the status check fails.
      .catch(() => {
        if (active) setHasUsers(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (isPending || hasUsers === null) {
    return <AppBootScreen />;
  }

  if (!session) {
    return <AuthScreen mode={hasUsers ? "login" : "create"} auth={{ signIn, signUp }} />;
  }

  return <>{children}</>;
}
