
/**
 * Workspace Selector
 *
 * Bottom-of-sidebar component for switching workspace context.
 * All workspace-filtered views (Tasks, Docs, Meetings, Projects) adapt
 * based on the selected workspace.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDown, Plus, Circle, Check, Pencil } from "lucide-react";
import { useWorkspaces, useCurrentWorkspace } from "@/stores/workspaces";
import { useNavigationStore } from "@/stores/navigation";
import { NewWorkspaceModal } from "@/components/workspaces/new-workspace-modal";
import { EditWorkspaceModal } from "@/components/workspaces/edit-workspace-modal";

interface WorkspaceSelectorProps {
  isCollapsed?: boolean;
}

// Default color when workspace has no color set
const DEFAULT_WORKSPACE_COLOR = "#64748b"; // slate-500

export function WorkspaceSelector({ isCollapsed = false }: WorkspaceSelectorProps) {
  const { t } = useTranslation();
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const currentWorkspace = useCurrentWorkspace();
  const setCurrentWorkspaceId = useNavigationStore((state) => state.setCurrentWorkspaceId);
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

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
          {!isCollapsed && t("nav.workspaceSwitcher.createWorkspace")}
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
      <div className={cn("px-2 py-3.5 border-t border-sidebar-border", isCollapsed && "px-1")}>
        <DropdownMenu>
          {isCollapsed ? (
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full h-11 hover:bg-sidebar-accent rounded-lg transition-all"
                title={currentWorkspace?.name || t("nav.workspaceSwitcher.selectWorkspace")}
              >
                <Circle
                  className="size-5 transition-transform hover:scale-110"
                  style={{ color: fillColor }}
                  fill={fillColor}
                />
              </Button>
            </DropdownMenuTrigger>
          ) : (
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between px-3 h-11 hover:bg-sidebar-accent/80 rounded-lg bg-sidebar-accent/30 border border-sidebar-border/50 transition-all hover:border-sidebar-border shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Circle
                    className="size-3.5 shrink-0"
                    style={{ color: fillColor }}
                    fill={fillColor}
                  />
                  <span className="font-medium truncate text-sidebar-foreground">
                    {currentWorkspace?.name || t("nav.workspaceSwitcher.selectWorkspace")}
                  </span>
                </div>
                <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
          )}

          <DropdownMenuContent
            align="start"
            side="top"
            className="w-60 p-1.5"
          >
            {workspaces.map((workspace) => {
              const isSelected = workspace.id === currentWorkspace?.id;
              const wsColor = workspace.color || DEFAULT_WORKSPACE_COLOR;

              return (
                <DropdownMenuItem
                  key={workspace.id}
                  className={cn(
                    "gap-2.5 cursor-pointer rounded-md px-2.5 py-2 transition-colors",
                    isSelected && "bg-accent"
                  )}
                  onClick={() => setCurrentWorkspaceId(workspace.id)}
                >
                  <Circle
                    className="size-3.5 shrink-0"
                    style={{ color: wsColor }}
                    fill={wsColor}
                  />
                  <span className="flex-1 truncate font-medium">{workspace.name}</span>
                  {isSelected && (
                    <div className="flex items-center gap-1">
                      <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setShowEditModal(true);
                        }}
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent-foreground/10 transition-colors"
                        title={t("nav.workspaceSwitcher.editWorkspace")}
                      >
                        <Pencil className="size-3.5" />
                      </span>
                      <Check className="size-4 text-primary" />
                    </div>
                  )}
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuItem
              className="gap-2.5 cursor-pointer rounded-md px-2.5 py-2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowNewWorkspaceModal(true)}
            >
              <Plus className="size-3.5" />
              <span className="font-medium">{t("menus.workspaceSwitcher.newWorkspace")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <NewWorkspaceModal
        open={showNewWorkspaceModal}
        onClose={() => setShowNewWorkspaceModal(false)}
      />

      {currentWorkspace && (
        <EditWorkspaceModal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          workspace={currentWorkspace}
        />
      )}
    </>
  );
}
