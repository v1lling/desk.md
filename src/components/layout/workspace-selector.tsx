"use client";

/**
 * Workspace Selector ("Work Mode")
 *
 * Bottom-of-sidebar component for switching workspace context.
 * All workspace-filtered views (Tasks, Docs, Meetings, Projects) adapt
 * based on the selected workspace.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDown, Plus, Circle, Check } from "lucide-react";
import { useWorkspaces, useCurrentWorkspace } from "@/stores/workspaces";
import { useSettingsStore } from "@/stores/settings";
import { NewWorkspaceModal } from "@/components/workspaces/new-workspace-modal";

interface WorkspaceSelectorProps {
  isCollapsed?: boolean;
}

// Default color when workspace has no color set
const DEFAULT_WORKSPACE_COLOR = "#64748b"; // slate-500

export function WorkspaceSelector({ isCollapsed = false }: WorkspaceSelectorProps) {
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const currentWorkspace = useCurrentWorkspace();
  const setCurrentWorkspaceId = useSettingsStore((state) => state.setCurrentWorkspaceId);
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);

  // Loading state
  if (isLoading) {
    return (
      <div className="px-2 py-3">
        <div className="h-10 bg-sidebar-accent/50 rounded-md animate-pulse" />
      </div>
    );
  }

  // No workspaces yet - show create button
  if (workspaces.length === 0) {
    return (
      <div className="px-2 py-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setShowNewWorkspaceModal(true)}
        >
          <Plus className="size-4" />
          {!isCollapsed && "Create Workspace"}
        </Button>
        <NewWorkspaceModal
          open={showNewWorkspaceModal}
          onClose={() => setShowNewWorkspaceModal(false)}
        />
      </div>
    );
  }

  const fillColor = currentWorkspace?.color || DEFAULT_WORKSPACE_COLOR;

  return (
    <>
      <div className={cn("px-2 py-3 border-t border-sidebar-border", isCollapsed && "px-1")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {isCollapsed ? (
              // Collapsed: just show color dot
              <Button
                variant="ghost"
                size="icon"
                className="w-full h-10 hover:bg-sidebar-accent"
                title={currentWorkspace?.name || "Select Workspace"}
              >
                <Circle
                  className="size-5"
                  style={{ color: fillColor }}
                  fill={fillColor}
                />
              </Button>
            ) : (
              // Expanded: show full selector
              <Button
                variant="ghost"
                className="w-full justify-between px-3 h-10 hover:bg-sidebar-accent"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Circle
                    className="size-3 shrink-0"
                    style={{ color: fillColor }}
                    fill={fillColor}
                  />
                  <span className="font-medium truncate">
                    {currentWorkspace?.name || "Select Workspace"}
                  </span>
                </div>
                <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
              </Button>
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            side="top"
            className="w-56"
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Work Mode
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {workspaces.map((workspace) => {
              const isSelected = workspace.id === currentWorkspace?.id;
              const wsColor = workspace.color || DEFAULT_WORKSPACE_COLOR;

              return (
                <DropdownMenuItem
                  key={workspace.id}
                  className="gap-2 cursor-pointer"
                  onClick={() => setCurrentWorkspaceId(workspace.id)}
                >
                  <Circle
                    className="size-3 shrink-0"
                    style={{ color: wsColor }}
                    fill={wsColor}
                  />
                  <span className="flex-1 truncate">{workspace.name}</span>
                  {isSelected && <Check className="size-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onClick={() => setShowNewWorkspaceModal(true)}
            >
              <Plus className="size-3" />
              New Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Work Mode label - only when expanded */}
        {!isCollapsed && (
          <p className="text-[10px] text-muted-foreground text-center mt-1">
            Work Mode
          </p>
        )}
      </div>

      <NewWorkspaceModal
        open={showNewWorkspaceModal}
        onClose={() => setShowNewWorkspaceModal(false)}
      />
    </>
  );
}
