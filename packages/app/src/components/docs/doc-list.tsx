
import { useTranslation } from "react-i18next";
import { DocCard } from "./doc-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Doc } from "@desk/core/types";

interface DocListProps {
  docs: Doc[];
  onDocClick?: (doc: Doc) => void;
}

export function DocList({ docs, onDocClick }: DocListProps) {
  const { t } = useTranslation();
  if (docs.length === 0) {
    return (
      <EmptyState
        title={t("emptyStates.docs.none.title")}
        description={t("emptyStates.docs.none.description")}
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
