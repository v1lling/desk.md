import { FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isTauri } from "@desk/core";
import { revealInFinder } from "@/components/docs/tree-item-utils";
import { isRemoteMode } from "@/lib/connection";
import { PATH_SEGMENTS } from "@desk/core";

interface EditorPathBarProps {
  filePath?: string;
}

/**
 * Split an absolute file path into its location (folder breadcrumb) and the
 * bare filename. The filename is a frozen `YYYY-MM-DD-slug.md` identifier — it
 * does not track the title and is not part of the navigable location — so it's
 * surfaced separately, styled as a technical id rather than a path segment.
 *
 * Example: /Users/x/Desk/workspaces/acme/projects/website/tasks/fix-bug.md
 *       → { location: ["acme", "website", "tasks"], filename: "fix-bug.md" }
 */
function getDisplayParts(filePath: string): { location: string[]; filename: string } {
  const marker = `/${PATH_SEGMENTS.WORKSPACES}/`;
  const idx = filePath.indexOf(marker);
  const segments =
    idx === -1
      ? [filePath.split("/").pop() || filePath]
      : // Filter out the "projects" directory segment — it's structural noise
        filePath.slice(idx + marker.length).split("/").filter((s) => s !== PATH_SEGMENTS.PROJECTS);

  const filename = segments.pop() || "";
  return { location: segments, filename };
}

export function EditorPathBar({ filePath }: EditorPathBarProps) {
  const { t } = useTranslation();
  if (!filePath) return null;

  const { location, filename } = getDisplayParts(filePath);
  // Reveal-in-Finder targets a local file; in remote mode the breadcrumb stays as a
  // read-only path display (no folder icon, no click, path-as-tooltip).
  const canReveal = isTauri() && !isRemoteMode();

  const handleClick = () => {
    if (canReveal) {
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
          title={canReveal ? t("editors.shared.revealInFinder") : filePath}
        >
          {location.map((segment, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted-foreground/30">/</span>}
              <span>{segment}</span>
            </span>
          ))}
          {/* Frozen filename identifier — set apart from the navigable location. */}
          {filename && (
            <span className="flex items-center gap-1.5">
              {location.length > 0 && <span className="text-muted-foreground/30">/</span>}
              <span className="font-mono text-muted-foreground/40">{filename}</span>
            </span>
          )}
          {canReveal && (
            <FolderOpen className="size-3 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      </div>
    </div>
  );
}
