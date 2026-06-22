
import { FileText, CheckSquare, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { parseDocPath, type AIMessageSource } from "@/lib/ai";
import { useTabStore } from "@/stores/tabs";

// =============================================================================
// Types
// =============================================================================

export interface SourcesDisplayProps {
  /** List of sources to display */
  sources: AIMessageSource[];
  /** Label shown before sources (default: "Sources:") */
  label?: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback when source is clicked (default: opens in tab) */
  onSourceClick?: (source: AIMessageSource) => void;
}

// =============================================================================
// Helper Components
// =============================================================================

function SourceIcon({ type }: { type: 'doc' | 'task' | 'meeting' }) {
  switch (type) {
    case 'task':
      return <CheckSquare className="h-3 w-3" />;
    case 'meeting':
      return <Calendar className="h-3 w-3" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
}

// =============================================================================
// Component
// =============================================================================

/**
 * Displays a list of assistant context sources as clickable badges.
 * Used in assistant messages and email drafting.
 *
 * Features:
 * - Shows icon based on content type (doc/task/meeting)
 * - Shows similarity score as percentage
 * - Clicking opens the source in a new tab
 *
 * @example
 * ```tsx
 * <SourcesDisplay
 *   sources={sources}
 *   label="Using context:"
 * />
 * ```
 */
export function SourcesDisplay({
  sources,
  label,
  className,
  onSourceClick,
}: SourcesDisplayProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t("assistant.sources.label");
  const openTab = useTabStore((state) => state.openTab);

  const parseRelativePath = (source: AIMessageSource): { workspaceId: string; entityId: string } | null => {
    if (!source.workspaceId) return null;

    const filename = source.docPath.split("/").pop();
    if (!filename) return null;
    const entityId = filename.replace(/\.md$/, "");
    if (!entityId) return null;

    return {
      workspaceId: source.workspaceId,
      entityId,
    };
  };

  const handleClick = (source: AIMessageSource) => {
    if (onSourceClick) {
      onSourceClick(source);
      return;
    }

    // Default: open in tab. Support both absolute file paths and workspace-relative index paths.
    const parsed = parseDocPath(source.docPath) ?? parseRelativePath(source);
    if (!parsed) return;

    openTab({
      type: source.contentType,
      entityId: parsed.entityId,
      title: source.title,
      workspaceId: parsed.workspaceId,
    });
  };

  if (sources.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      <span className="text-xs text-muted-foreground">{resolvedLabel}</span>
      {sources.map((source, idx) => (
        <button
          key={idx}
          onClick={() => handleClick(source)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 hover:bg-muted rounded px-1.5 py-0.5 transition-colors cursor-pointer"
          title={
            source.workspaceName
              ? t("assistant.sources.openTitleWithWorkspace", {
                  title: source.title,
                  workspace: source.workspaceName,
                })
              : t("assistant.sources.openTitle", { title: source.title })
          }
        >
          <SourceIcon type={source.contentType} />
          {source.workspaceName && (
            <span className="text-[10px] opacity-60 font-medium">{source.workspaceName}:</span>
          )}
          <span className="max-w-[150px] truncate">{source.title}</span>
          {source.score !== undefined && (
            <span className="text-[10px] opacity-60">
              {Math.round(source.score * 100)}%
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
