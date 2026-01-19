"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProjectPageClient } from "./client";

// Use query parameters for dynamic project IDs with static export
// URL: /projects/view?id=project-id&meeting=meeting-id
function ProjectViewContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("id");
  const meetingId = searchParams.get("meeting");

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No project selected</p>
      </div>
    );
  }

  return <ProjectPageClient projectId={projectId} openMeetingId={meetingId} />;
}

export default function ProjectViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
      <ProjectViewContent />
    </Suspense>
  );
}
