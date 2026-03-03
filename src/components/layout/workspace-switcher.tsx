
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDown, Plus, Circle } from "lucide-react";
import { useWorkspaces, useCurrentWorkspace } from "@/stores/workspaces";
import { useSettingsStore } from "@/stores/settings";
import { NewWorkspaceModal } from "@/components/workspaces/new-workspace-modal";

interface WorkspaceSwitcherProps {
  collapsed?: boolean;
}

// Default color when workspace has no color set
const DEFAULT_WORKSPACE_COLOR = "#64748b"; // slate-500

// Color indicator dot for workspaces
function WorkspaceDot({ color, size = "sm" }: { color?: string; size?: "sm" | "lg" }) {
  const fillColor = color || DEFAULT_WORKSPACE_COLOR;
  return (
    <Circle
      className={size === "lg" ? "size-5" : "size-3"}
      style={{ color: fillColor }}
      fill={fillColor}
    />
  );
}

export function WorkspaceSwitcher({ collapsed = false }: WorkspaceSwitcherProps) {
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const currentWorkspace = useCurrentWorkspace();
  const setCurrentWorkspaceId = useSettingsStore((state) => state.setCurrentWorkspaceId);
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);

  if (isLoading || !currentWorkspace) {
    return null;
  }

  // Shared dropdown content - avoids duplication between collapsed/expanded states
  const dropdownContent = (
    <DropdownMenuContent align="start" className={collapsed ? "w-48" : "w-56"}>
      {workspaces.map((workspace) => (
        <DropdownMenuItem
          key={workspace.id}
          className={cn("gap-2", workspace.id === currentWorkspace.id && "bg-accent")}
          onClick={() => setCurrentWorkspaceId(workspace.id)}
        >
          <WorkspaceDot color={workspace.color} />
          {workspace.name}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="gap-2"
        onClick={() => setShowNewWorkspaceModal(true)}
      >
        <Plus className="size-3" />
        New Workspace
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {collapsed ? (
            <Button variant="ghost" size="icon" className="size-10">
              <WorkspaceDot color={currentWorkspace.color} size="lg" />
            </Button>
          ) : (
            <Button variant="ghost" className="w-full justify-between px-3 h-10">
              <div className="flex items-center gap-2">
                <WorkspaceDot color={currentWorkspace.color} />
                <span className="font-semibold">{currentWorkspace.name}</span>
              </div>
              <ChevronsUpDown className="size-4 opacity-50" />
            </Button>
          )}
        </DropdownMenuTrigger>
        {dropdownContent}
      </DropdownMenu>

      <NewWorkspaceModal
        open={showNewWorkspaceModal}
        onClose={() => setShowNewWorkspaceModal(false)}
      />
    </>
  );
}
