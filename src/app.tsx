import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
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
import ProjectViewPage from "./pages/project-view";
import ProjectsPage from "./pages/projects";
import PlannerPage from "./pages/planner";

function ProjectRootRedirect() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to={`/projects/${id}/tasks`} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Providers>
        <ErrorBoundary>
          <AppShell>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/planner" element={<PlannerPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/meetings" element={<MeetingsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectRootRedirect />} />
              <Route path="/projects/:id/:section" element={<ProjectViewPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
          <GlobalSearch />
        </ErrorBoundary>
        <Toaster position="bottom-right" />
      </Providers>
    </BrowserRouter>
  );
}
