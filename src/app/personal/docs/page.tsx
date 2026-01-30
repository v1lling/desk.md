"use client";

import { ContentExplorer, type ContentExplorerScope } from "@/components/docs";

const personalScope: ContentExplorerScope[] = [
  {
    id: "personal",
    label: "Personal",
    scope: "personal",
  },
];

export default function PersonalDocsPage() {
  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 h-full overflow-hidden">
        <ContentExplorer scopes={personalScope} />
      </main>
    </div>
  );
}
