"use client";

import { DocCard } from "./doc-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Doc } from "@/types";

interface DocListProps {
  docs: Doc[];
  onDocClick?: (doc: Doc) => void;
}

export function DocList({ docs, onDocClick }: DocListProps) {
  if (docs.length === 0) {
    return (
      <EmptyState
        title="No docs yet"
        description="Create your first doc to get started"
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {docs.map((doc) => (
        <DocCard
          key={doc.id}
          doc={doc}
          onClick={() => onDocClick?.(doc)}
        />
      ))}
    </div>
  );
}
