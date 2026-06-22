import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth-client";

interface AuthScreenProps {
  /** "create" on a fresh deployment (no users yet), "login" once an account exists. */
  mode: "create" | "login";
}

/**
 * Hosted-mode login + first-run account creation (step 3b). Rendered by the
 * app-shell gate when running hosted (VITE_DESK_HOSTED) and unauthenticated. On
 * success Better Auth sets the session cookie and useSession() flips, so the
 * gate re-renders into the app.
 */
export function AuthScreen({ mode }: AuthScreenProps) {
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
      // Reload so the whole app boots fresh WITH the session cookie. This is not
      // just to re-run the gate (useSession would flip reactively) — the
      // background bootstrap hooks in providers.tsx (search index, context-index
      // sync) build once on mount, above the gate; reloading lets them build
      // authenticated instead of being stuck with their pre-login 401 result.
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
