import { useEffect, useState } from "react";
import { ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import { open as openShell } from "@tauri-apps/plugin-shell";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  getDeskPath,
  joinPath,
  readTextFile,
  exists,
  isTauri,
} from "@/lib/desk/tauri-fs";
import { getWorkspacePath } from "@/lib/desk/paths";
import { FILE_NAMES } from "@/lib/desk/constants";

interface Props {
  scope: "global" | string;
}

// CLAUDE/AGENTS/GEMINI have identical content — previewing CLAUDE.md is enough.
export function AgentFilePreviewCard({ scope }: Props) {
  const isGlobal = scope === "global";
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFile = async () => {
    if (!isTauri()) {
      setError("Preview is only available in the desktop app.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const parent = isGlobal ? await getDeskPath() : await getWorkspacePath(scope);
      const filePath = await joinPath(parent, FILE_NAMES.CLAUDE_MD);
      if (!(await exists(filePath))) {
        setContent(null);
        setError("File doesn't exist yet — toggle CLAUDE.md on, then come back.");
        return;
      }
      setContent(await readTextFile(filePath));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && content === null && error === null) void loadFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleReveal = async () => {
    if (!isTauri()) return;
    try {
      const parent = isGlobal ? await getDeskPath() : await getWorkspacePath(scope);
      await openShell(parent);
    } catch {
      // best-effort
    }
  };

  return (
    <div className="space-y-2 py-3 border-t border-border/40">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              open && "rotate-90"
            )}
          />
          Preview generated CLAUDE.md
        </button>
        <Button variant="ghost" size="sm" onClick={handleReveal} className="text-xs">
          <ExternalLink className="h-3 w-3 mr-1" />
          Reveal in Finder
        </Button>
      </div>

      {open && (
        <div className="space-y-2">
          {loading && (
            <p className="text-xs text-muted-foreground italic">Loading…</p>
          )}
          {error && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
          )}
          {content !== null && (
            <>
              <pre className="p-3 rounded-md bg-muted text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                {content}
              </pre>
              <Button variant="ghost" size="sm" onClick={loadFile} className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
