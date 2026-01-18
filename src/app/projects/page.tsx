"use client";

import { useState } from "react";
import { Header } from "@/components/layout";
import { ProjectList, NewProjectModal } from "@/components/projects";

export default function ProjectsPage() {
  const [showNewProject, setShowNewProject] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Projects"
        action={{
          label: "New Project",
          onClick: () => setShowNewProject(true),
        }}
      />
      <div className="flex-1 p-6 overflow-auto">
        <ProjectList />
      </div>

      <NewProjectModal
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
      />
    </div>
  );
}
