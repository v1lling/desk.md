
import { FileText, CheckSquare, Calendar } from "lucide-react";
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
 * Displays a list of RAG sources as clickable badges.
 * Used in AI chat messages and email drafting.
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
  label = "Sources:",
  className,
  onSourceClick,
}: SourcesDisplayProps) {
  const openTab = useTabStore((state) => state.openTab);

  const handleClick = (source: AIMessageSource) => {
    if (onSourceClick) {
      onSourceClick(source);
      return;
    }

    // Default: open in tab
    const parsed = parseDocPath(source.docPath);
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
      <span className="text-xs text-muted-foreground">{label}</span>
      {sources.map((source, idx) => (
        <button
          key={idx}
          onClick={() => handleClick(source)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 hover:bg-muted rounded px-1.5 py-0.5 transition-colors cursor-pointer"
          title={`Open ${source.title}${source.workspaceName ? ` (${source.workspaceName})` : ''}`}
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
