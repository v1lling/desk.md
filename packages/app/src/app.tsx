import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Providers } from "./app/providers";
import { AppShell } from "./app/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { GlobalSearch } from "@/components/global-search";
import { ErrorBoundary } from "@/components/error-boundary";

const DashboardPage = lazy(() => import("./pages/dashboard"));
const TasksPage = lazy(() => import("./pages/tasks"));
const DocsPage = lazy(() => import("./pages/docs"));
const MeetingsPage = lazy(() => import("./pages/meetings"));
const SettingsPage = lazy(() => import("./pages/settings"));
const ProjectsPage = lazy(() => import("./pages/projects"));
const PlannerPage = lazy(() => import("./pages/planner"));

// Hosted-web only: the OAuth AS's login + consent pages (the redirect targets that let a
// Claude/ChatGPT custom connector complete its grant). Gated on the constant
// `VITE_DESK_HOSTED` (null in native), so Rollup drops the dynamic import and the Tauri /
// browser-mock bundles never pull in better-auth (or auth-client) through here.
const OAuthSignIn = import.meta.env.VITE_DESK_HOSTED
  ? lazy(() => import("./pages/oauth-sign-in"))
  : null;
const OAuthConsent = import.meta.env.VITE_DESK_HOSTED
  ? lazy(() => import("./pages/oauth-consent"))
  : null;

function LoadingView({ fullScreen = false }: { fullScreen?: boolean }) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex items-center justify-center bg-background ${fullScreen ? "h-screen" : "h-full"}`}
    >
      <div className="animate-pulse text-sm text-muted-foreground">
        {t("common.buttons.loading")}
      </div>
    </div>
  );
}

/** The normal app: shell (with its auth gate) + global search. */
function AppTree() {
  return (
    <>
      <AppShell>
        <Suspense fallback={<LoadingView />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/meetings" element={<MeetingsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
      <GlobalSearch />
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Providers>
        <ErrorBoundary>
          {OAuthSignIn && OAuthConsent ? (
            // The OAuth pages must render OUTSIDE the app shell's auth gate (the AS lands
            // here pre-session). Everything else falls through to the normal app.
            <Suspense fallback={<LoadingView fullScreen />}>
              <Routes>
                <Route path="/sign-in" element={<OAuthSignIn />} />
                <Route path="/oauth/consent" element={<OAuthConsent />} />
                <Route path="/*" element={<AppTree />} />
              </Routes>
            </Suspense>
          ) : (
            <AppTree />
          )}
        </ErrorBoundary>
        <Toaster position="bottom-right" />
      </Providers>
    </BrowserRouter>
  );
}
