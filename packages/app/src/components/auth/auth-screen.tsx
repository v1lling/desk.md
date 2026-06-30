import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The minimal email-auth surface AuthScreen needs. Both the same-origin web client
 * (`@/lib/auth-client`) and the native bearer client (`@/lib/native-auth-client`)
 * satisfy it, so the same screen drives web (cookie) and native (Keychain token) login.
 * The caller supplies the client — AuthScreen never imports one itself, so the
 * hosted-web-only `auth-client` (which reads `window.location.origin` at module load)
 * stays out of the native bundle.
 */
export interface AuthActions {
  signIn: { email: (args: { email: string; password: string }) => Promise<{ error?: { message?: string } | null }> };
  signUp: {
    email: (args: { email: string; password: string; name: string }) => Promise<{ error?: { message?: string } | null }>;
  };
}

interface AuthScreenProps {
  /** "create" on a fresh deployment (no users yet), "login" once an account exists. */
  mode: "create" | "login";
  /** Auth client to use — the same-origin web client (cookie) or the native bearer client. */
  auth: AuthActions;
  /**
   * What to do once the session is established. Defaults to a full reload (the gate
   * use-case). The OAuth sign-in page passes its own handler to resume the authorize
   * flow instead. Throwing/rejecting here surfaces as the generic error.
   */
  onSuccess?: () => void | Promise<void>;
}

/**
 * Hosted-mode login + first-run account creation (step 3b). Rendered by the
 * app-shell gate when running hosted (web VITE_DESK_HOSTED, or native remote mode)
 * and unauthenticated. On success the session is established (cookie on web, Keychain
 * bearer token on native) and the screen reloads so the app boots authenticated.
 */
export function AuthScreen({ mode, auth, onSuccess }: AuthScreenProps) {
  const { signIn, signUp } = auth;
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCreate = mode === "create";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = isCreate
        ? await signUp.email({ email, password, name: email.split("@")[0] || email })
        : await signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message ?? t("auth.errors.generic"));
        setIsLoading(false);
        return;
      }
      // A caller can override what "success" does (the OAuth sign-in page resumes the
      // authorize flow). Default: reload so the whole app boots fresh WITH the session
      // cookie. This is not just to re-run the gate (useSession would flip reactively) —
      // the background bootstrap hooks in providers.tsx (search index, context-index
      // sync) build once on mount, above the gate; reloading lets them build
      // authenticated instead of being stuck with their pre-login 401 result.
      if (onSuccess) {
        await onSuccess();
        return;
      }
      window.location.reload();
    } catch {
      setError(t("auth.errors.generic"));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex items-center justify-center px-8">
        <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-6">
          <div className="flex flex-col items-center text-center gap-4">
            <img src="/icon.png" alt="Desk" width={56} height={56} className="rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <h1 className="text-lg font-semibold tracking-tight">
                {isCreate ? t("auth.create.title") : t("auth.login.title")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isCreate ? t("auth.create.subtitle") : t("auth.login.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("auth.fields.email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("auth.fields.password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isCreate ? "new-password" : "current-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !email.trim() || !password}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isCreate ? t("auth.create.submit") : t("auth.login.submit")}
          </Button>
        </form>
      </main>
    </div>
  );
}
