import { FolderOpen } from "lucide-react";
import { isTauri } from "@/lib/desk/tauri-fs";
import { revealInFinder } from "@/components/docs/tree-item-utils";
import { PATH_SEGMENTS } from "@/lib/desk/constants";

interface EditorPathBarProps {
  filePath?: string;
}

/**
 * Derive a display path from an absolute file path.
 * Strips everything up to and including "/workspaces/" and filters
 * out structural segments like "projects" to keep it readable.
 *
 * Example: /Users/x/Desk/workspaces/acme/projects/website/tasks/fix-bug.md
 *       → ["acme", "website", "tasks", "fix-bug.md"]
 */
function getDisplaySegments(filePath: string): string[] {
  const marker = `/${PATH_SEGMENTS.WORKSPACES}/`;
  const idx = filePath.indexOf(marker);
  if (idx === -1) return [filePath.split("/").pop() || filePath];

  const relative = filePath.slice(idx + marker.length);
  // Filter out the "projects" directory segment — it's structural noise
  return relative.split("/").filter((s) => s !== PATH_SEGMENTS.PROJECTS);
}

export function EditorPathBar({ filePath }: EditorPathBarProps) {
  if (!filePath) return null;

  const segments = getDisplaySegments(filePath);

  const handleClick = () => {
    if (isTauri()) {
      revealInFinder(filePath);
    }
  };

  return (
    <div className="shrink-0">
      <div className="max-w-4xl mx-auto px-6 pt-3">
        <button
          type="button"
          onClick={handleClick}
          className="group flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-default"
          title={isTauri() ? "Reveal in Finder" : filePath}
        >
          {segments.map((segment, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted-foreground/30">/</span>}
              <span className={i === segments.length - 1 ? "text-muted-foreground/60" : ""}>
                {segment}
              </span>
            </span>
          ))}
          {isTauri() && (
            <FolderOpen className="size-3 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      </div>
    </div>
  );
}
