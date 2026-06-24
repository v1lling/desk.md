import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Providers } from "./app/providers";
import { AppShell } from "./app/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { GlobalSearch } from "@/components/global-search";
import { ErrorBoundary } from "@/components/error-boundary";
import DashboardPage from "./pages/dashboard";
import TasksPage from "./pages/tasks";
import DocsPage from "./pages/docs";
import MeetingsPage from "./pages/meetings";
import SettingsPage from "./pages/settings";
import ProjectsPage from "./pages/projects";
import PlannerPage from "./pages/planner";
import AssistantPage from "./pages/assistant";

// Hosted-web only: the OAuth AS's login + consent pages (the redirect targets that let a
// Claude/ChatGPT custom connector complete its grant). Lazy + flag-gated so the Tauri /
// browser-mock bundles never pull in better-auth through here.
const OAuthSignIn = lazy(() => import("./pages/oauth-sign-in"));
const OAuthConsent = lazy(() => import("./pages/oauth-consent"));

/** The normal app: shell (with its auth gate) + global search. */
function AppTree() {
  return (
    <>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/meetings" element={<MeetingsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
          {import.meta.env.VITE_DESK_HOSTED ? (
            // The OAuth pages must render OUTSIDE the app shell's auth gate (the AS lands
            // here pre-session). Everything else falls through to the normal app.
            <Suspense fallback={null}>
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
