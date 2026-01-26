"use client";

import { DocExplorer, type DocExplorerScope } from "@/components/docs";

const personalScope: DocExplorerScope[] = [
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
        <DocExplorer scopes={personalScope} />
      </main>
    </div>
  );
}
