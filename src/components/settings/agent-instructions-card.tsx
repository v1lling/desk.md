import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAgentInstructionsStore } from "@/stores/agent-instructions";

interface Props {
  /** "global" for top-level files; a workspaceId for per-workspace files. */
  scope: "global" | string;
}

const GLOBAL_PLACEHOLDER =
  "e.g., Always reply in German. Use Conventional Commit prefixes when writing files.";
const WORKSPACE_PLACEHOLDER =
  "e.g., This workspace is for client X. Never reference internal projects in drafts.";

export function AgentInstructionsCard({ scope }: Props) {
  const isGlobal = scope === "global";
  const { global, perWorkspace, setGlobal, setForWorkspace } = useAgentInstructionsStore();

  const value = isGlobal ? global : (perWorkspace[scope] ?? "");
  const placeholder = isGlobal ? GLOBAL_PLACEHOLDER : WORKSPACE_PLACEHOLDER;

  const handleChange = (next: string) => {
    if (isGlobal) setGlobal(next);
    else setForWorkspace(scope, next);
  };

  const target = isGlobal
    ? "top-level CLAUDE.md / AGENTS.md / GEMINI.md"
    : "this workspace's CLAUDE.md / AGENTS.md / GEMINI.md";

  return (
    <div className="space-y-2 py-3">
      <Label htmlFor={`agent-instructions-${scope}`}>
        {isGlobal ? "Global Instructions" : "Workspace Instructions"}
      </Label>
      <p className="text-sm text-muted-foreground">
        Inlined into the {target} between{" "}
        <code className="text-xs">desk:user-instructions</code> markers on every regen.
      </p>
      <Textarea
        id={`agent-instructions-${scope}`}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[140px] font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        {value.length} characters · saves automatically · written on the next regen.
      </p>
    </div>
  );
}
