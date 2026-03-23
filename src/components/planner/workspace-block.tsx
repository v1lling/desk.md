/**
 * WorkspaceBlockCard — Colored block showing workspace + nested tasks
 * Sortable (drag to reorder) and droppable (receive tasks from pool)
 */

import { useState, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Circle, GripVertical, StickyNote, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Textarea } from "@/components/ui/textarea";
import { usePlannerStore } from "@/stores/planner";
import { useOpenTab } from "@/stores/tabs";
import { MiniTaskItem } from "./mini-task-item";
import type { WorkspaceBlock } from "@/types";
import type { Workspace } from "@/types";
import type { ActiveTask } from "@/lib/desk/dashboard";

interface WorkspaceBlockCardProps {
  block: WorkspaceBlock;
  day: string;
  weekOf: string;
  allTasks: ActiveTask[];
  workspaces: Workspace[];
}

export function WorkspaceBlockCard({
  block,
  day,
  weekOf,
  allTasks,
  workspaces,
}: WorkspaceBlockCardProps) {
  const workspace = workspaces.find((w) => w.id === block.workspaceId);
  const removeBlock = usePlannerStore((s) => s.removeBlock);
  const updateBlock = usePlannerStore((s) => s.updateBlock);
  const removeTaskFromBlock = usePlannerStore((s) => s.removeTaskFromBlock);
  const { openTask } = useOpenTab();

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(block.notes || "");

  const color = workspace?.color || "#64748b";

  // Sortable for reordering blocks within/across days
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `block:${block.id}`,
    data: { type: "block", blockId: block.id, day },
  });

  // Droppable zone for receiving tasks
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `blockzone:${block.id}`,
    data: { type: "blockzone", blockId: block.id, day },
  });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Resolve task references, filtering out deleted tasks
  const tasks = useMemo(
    () =>
      block.taskIds
        .map((id) => allTasks.find((t) => t.id === id))
        .filter((t): t is ActiveTask => t != null),
    [block.taskIds, allTasks]
  );

  const handleTaskClick = (task: ActiveTask) => {
    openTask({
      id: task.id,
      title: task.title,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
    });
  };

  const handleDelete = () => {
    removeBlock(weekOf, day, block.id);
  };

  const handleEditNotes = () => {
    setNotesValue(block.notes || "");
    setEditingNotes(true);
  };

  const handleSaveNotes = () => {
    updateBlock(weekOf, day, block.id, {
      notes: notesValue.trim() || undefined,
    });
    setEditingNotes(false);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setSortableRef}
          style={{
            ...sortableStyle,
            borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
            backgroundColor: isOver
              ? `color-mix(in srgb, ${color} 12%, var(--color-card))`
              : `color-mix(in srgb, ${color} 6%, var(--color-card))`,
          }}
          className={cn(
            "rounded-lg border p-2 transition-colors",
            isOver && "ring-2 ring-primary/30",
            isDragging && "opacity-40"
          )}
        >
          {/* Header */}
          <div className="group/header flex items-center gap-1 mb-1">
            <button
              className="shrink-0 cursor-grab opacity-0 group-hover/header:opacity-60 hover:!opacity-100 transition-opacity touch-none"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            </button>
            <Circle
              className="h-2.5 w-2.5 shrink-0"
              style={{ color, fill: color }}
            />
            <span className="text-xs font-medium truncate flex-1">
              {workspace?.name || block.workspaceId}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditNotes();
              }}
              className={cn(
                "shrink-0 p-0.5 rounded hover:bg-muted transition-opacity",
                block.notes
                  ? "opacity-60 hover:opacity-100"
                  : "opacity-0 group-hover/header:opacity-40 hover:!opacity-100"
              )}
              title="Edit notes"
            >
              <StickyNote className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>

          {/* Notes display or editor */}
          {editingNotes ? (
            <div className="pl-4 mb-1.5">
              <Textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                onBlur={handleSaveNotes}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveNotes();
                  }
                  if (e.key === "Escape") {
                    setEditingNotes(false);
                  }
                }}
                placeholder="Add a note..."
                rows={2}
                className="text-[11px] resize-none"
                autoFocus
              />
            </div>
          ) : (
            block.notes && (
              <p
                className="text-[11px] text-muted-foreground mb-1.5 line-clamp-2 pl-4 cursor-pointer hover:text-foreground/70 transition-colors"
                onClick={handleEditNotes}
              >
                {block.notes}
              </p>
            )
          )}

          {/* Task drop zone */}
          <div ref={setDropRef}>
            {/* Tasks */}
            {tasks.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {tasks.map((task) => (
                  <MiniTaskItem
                    key={task.id}
                    task={task}
                    onClick={() => handleTaskClick(task)}
                    onRemove={() =>
                      removeTaskFromBlock(weekOf, day, block.id, task.id)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleEditNotes}>
          <StickyNote className="h-4 w-4" />
          Edit notes
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Remove block
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
