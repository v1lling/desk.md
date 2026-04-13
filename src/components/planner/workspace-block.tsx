/**
 * TimeBlock — Time-positioned workspace block with resize handles and drag support.
 * Absolutely positioned within a day column based on startMinute/endMinute.
 * Content adapts to block height: compact for short blocks, full for tall ones.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Circle, StickyNote, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { usePlannerStore } from "@/stores/planner";
import { useOpenTab } from "@/stores/tabs";
import {
  minuteToPixel,
  minutesToTime,
  snapToSlot,
  blocksOverlap,
} from "@/lib/desk/planner";
import { MiniTaskItem } from "./mini-task-item";
import { MiniNoteItem } from "./mini-note-item";
import { TaskPickerPopover } from "./task-picker-popover";
import type { WorkspaceBlock, Workspace } from "@/types";
import type { ActiveTask } from "@/lib/desk/dashboard";

interface TimeBlockProps {
  block: WorkspaceBlock;
  day: string;
  weekOf: string;
  allTasks: ActiveTask[];
  workspaces: Workspace[];
  gridStartMinute: number;
  slotHeight: number;
  siblingBlocks: WorkspaceBlock[];
  onDragStart?: (blockId: string, day: string, e: React.MouseEvent) => void;
}

export function TimeBlock({
  block,
  day,
  weekOf,
  allTasks,
  workspaces,
  gridStartMinute,
  slotHeight,
  siblingBlocks,
  onDragStart,
}: TimeBlockProps) {
  const workspace = workspaces.find((w) => w.id === block.workspaceId);
  const removeBlock = usePlannerStore((s) => s.removeBlock);
  const updateBlockTime = usePlannerStore((s) => s.updateBlockTime);
  const addTaskToBlock = usePlannerStore((s) => s.addTaskToBlock);
  const removeTaskFromBlock = usePlannerStore((s) => s.removeTaskFromBlock);
  const addNoteToBlock = usePlannerStore((s) => s.addNoteToBlock);
  const removeNoteFromBlock = usePlannerStore((s) => s.removeNoteFromBlock);
  const updateNoteInBlock = usePlannerStore((s) => s.updateNoteInBlock);
  const { openTask } = useOpenTab();

  const [addingNote, setAddingNote] = useState(false);

  // Resize state — stored as local visual override, committed on mouseup
  const [resizePreview, setResizePreview] = useState<{
    startMinute: number;
    endMinute: number;
  } | null>(null);

  const resizeRef = useRef<{
    edge: "top" | "bottom";
    startY: number;
    originalStart: number;
    originalEnd: number;
  } | null>(null);

  const color = workspace?.color || "#64748b";

  // Ref for resize handler (avoids stale closure)
  const slotHeightRef = useRef(slotHeight);
  slotHeightRef.current = slotHeight;

  // Current display values (preview during resize, actual otherwise)
  const displayStart = resizePreview?.startMinute ?? block.startMinute;
  const displayEnd = resizePreview?.endMinute ?? block.endMinute;

  const top = minuteToPixel(displayStart, gridStartMinute, slotHeight);
  const height = ((displayEnd - displayStart) / 30) * slotHeight;

  // Content adaptation based on time duration
  const duration = displayEnd - displayStart;
  const isCompact = duration < 60; // < 1 hour
  const isMedium = duration >= 60 && duration < 120; // 1–2 hours

  // Resolve task references
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

  const handleDelete = () => removeBlock(weekOf, day, block.id);

  const handleAddNote = (note: string) => {
    addNoteToBlock(weekOf, day, block.id, note);
  };

  // ── Resize handling ──────────────────────────────────────────────

  // Cleanup ref for resize listeners — prevents memory leak on unmount
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => resizeCleanupRef.current?.(), []);

  // Ref to track the latest resize preview for the mouseup handler
  const resizePreviewRef = useRef(resizePreview);
  resizePreviewRef.current = resizePreview;

  const clampToSiblings = useCallback(
    (startMin: number, endMin: number): { startMinute: number; endMinute: number } => {
      let clampedStart = startMin;
      let clampedEnd = endMin;
      const edge = resizeRef.current?.edge;
      const sorted = [...siblingBlocks].sort((a, b) => a.startMinute - b.startMinute);

      for (const s of sorted) {
        if (!blocksOverlap({ startMinute: clampedStart, endMinute: clampedEnd }, s)) continue;
        if (edge === "top") {
          clampedStart = s.endMinute;
        } else {
          clampedEnd = s.startMinute;
        }
      }

      // Minimum 30-minute block
      if (clampedEnd - clampedStart < 30) {
        if (edge === "top") {
          clampedStart = clampedEnd - 30;
        } else {
          clampedEnd = clampedStart + 30;
        }
      }

      return { startMinute: Math.max(0, clampedStart), endMinute: Math.min(1440, clampedEnd) };
    },
    [siblingBlocks]
  );

  const handleResizeStart = useCallback(
    (edge: "top" | "bottom", e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      resizeRef.current = {
        edge,
        startY: e.clientY,
        originalStart: block.startMinute,
        originalEnd: block.endMinute,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const deltaY = ev.clientY - resizeRef.current.startY;
        const deltaMinutes = (deltaY / slotHeightRef.current) * 30;

        let newStart = resizeRef.current.originalStart;
        let newEnd = resizeRef.current.originalEnd;

        if (edge === "top") {
          newStart = snapToSlot(resizeRef.current.originalStart + deltaMinutes);
        } else {
          newEnd = snapToSlot(resizeRef.current.originalEnd + deltaMinutes);
        }

        const clamped = clampToSiblings(newStart, newEnd);
        resizePreviewRef.current = clamped;
        setResizePreview(clamped);
      };

      const cleanup = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        resizeCleanupRef.current = null;
      };

      const handleMouseUp = () => {
        cleanup();

        if (resizePreviewRef.current) {
          updateBlockTime(
            weekOf,
            day,
            block.id,
            resizePreviewRef.current.startMinute,
            resizePreviewRef.current.endMinute
          );
        }
        setResizePreview(null);
        resizeRef.current = null;
      };

      resizeCleanupRef.current = cleanup;
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [block, weekOf, day, updateBlockTime, clampToSiblings]
  );

  // ── Drag handling (body) ─────────────────────────────────────────

  const handleBodyMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only left button, don't interfere with context menu or other elements
      if (e.button !== 0) return;
      // Don't drag if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest("button, textarea, [role=menuitem], [data-no-drag]")) return;

      onDragStart?.(block.id, day, e);
    },
    [block.id, day, onDragStart]
  );

  const timeLabel = `${minutesToTime(displayStart)} – ${minutesToTime(displayEnd)}`;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "absolute left-1 right-1 rounded-lg border overflow-hidden transition-shadow",
            "hover:shadow-md group/block",
            resizePreview && "shadow-lg ring-1 ring-primary/20"
          )}
          style={{
            top,
            height,
            borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
            backgroundColor: `color-mix(in srgb, ${color} 8%, var(--color-card))`,
            zIndex: resizePreview ? 20 : 10,
          }}
          onMouseDown={handleBodyMouseDown}
        >
          {/* Top resize handle */}
          <div
            className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-20 group/resize-top"
            onMouseDown={(e) => handleResizeStart("top", e)}
          >
            <div className="absolute left-1/2 -translate-x-1/2 w-8 top-0.5 h-0.5 rounded-full bg-foreground/0 group-hover/block:bg-foreground/20 group-hover/resize-top:!bg-primary/50 transition-colors" />
          </div>

          {/* Block content */}
          <div className="h-full flex flex-col px-2 py-1.5 cursor-grab active:cursor-grabbing">
            {/* Header — always visible */}
            <div className="flex items-center gap-1.5 shrink-0 min-w-0">
              <Circle
                className="h-2.5 w-2.5 shrink-0"
                style={{ color, fill: color }}
              />
              <span className="text-xs font-medium truncate flex-1">
                {workspace?.name || block.workspaceId}
              </span>
              {isCompact && tasks.length > 0 && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {tasks.length}
                </span>
              )}
            </div>

            {/* Time label — compact only */}
            {isCompact && (
              <span className="text-[10px] text-muted-foreground/60 truncate">
                {timeLabel}
              </span>
            )}

            {/* Notes — medium and full */}
            {!isCompact && block.notes && block.notes.length > 0 && (
              <div className="mt-0.5 space-y-0.5 shrink-0" data-no-drag>
                {block.notes
                  .slice(0, isMedium ? 2 : undefined)
                  .map((note, index) => (
                    <MiniNoteItem
                      key={`${block.id}-note-${index}`}
                      note={note}
                      onEdit={(newText) =>
                        updateNoteInBlock(weekOf, day, block.id, index, newText)
                      }
                      onRemove={() =>
                        removeNoteFromBlock(weekOf, day, block.id, index)
                      }
                    />
                  ))}
                {isMedium && block.notes.length > 2 && (
                  <span className="text-[10px] text-muted-foreground pl-1.5">
                    +{block.notes.length - 2} more
                  </span>
                )}
              </div>
            )}
            {!isCompact && addingNote && (
              <div className="mt-0.5 shrink-0" data-no-drag>
                <input
                  type="text"
                  className="w-full text-xs px-1.5 py-1 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="Type a note..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.currentTarget.value.trim()) {
                      addNoteToBlock(weekOf, day, block.id, e.currentTarget.value.trim());
                      setAddingNote(false);
                    }
                    if (e.key === "Escape") setAddingNote(false);
                  }}
                  onBlur={(e) => {
                    if (e.currentTarget.value.trim()) {
                      addNoteToBlock(weekOf, day, block.id, e.currentTarget.value.trim());
                    }
                    setAddingNote(false);
                  }}
                />
              </div>
            )}

            {/* Tasks — medium and full */}
            {!isCompact && tasks.length > 0 && (
              <div className="flex-1 min-h-0 overflow-hidden mt-1">
                <div className="space-y-0.5">
                  {tasks.slice(0, isMedium ? 3 : undefined).map((task) => (
                    <MiniTaskItem
                      key={task.id}
                      task={task}
                      onClick={() => handleTaskClick(task)}
                      onRemove={() =>
                        removeTaskFromBlock(weekOf, day, block.id, task.id)
                      }
                    />
                  ))}
                  {isMedium && tasks.length > 3 && (
                    <span className="text-[10px] text-muted-foreground pl-1.5">
                      +{tasks.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Task picker — full mode only */}
            {!isCompact && !isMedium && (
              <div className="mt-auto pt-1 shrink-0" data-no-drag>
                <TaskPickerPopover
                  workspaceId={block.workspaceId}
                  allTasks={allTasks}
                  assignedTaskIds={block.taskIds}
                  onSelectTask={(taskId) =>
                    addTaskToBlock(weekOf, day, block.id, taskId)
                  }
                  onAddNote={handleAddNote}
                />
              </div>
            )}

            {/* Time label — bottom, medium+ */}
            {!isCompact && (
              <span className="text-[10px] text-muted-foreground/50 mt-auto pt-0.5 shrink-0">
                {timeLabel}
              </span>
            )}
          </div>

          {/* Bottom resize handle */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize z-20 group/resize-bottom"
            onMouseDown={(e) => handleResizeStart("bottom", e)}
          >
            <div className="absolute left-1/2 -translate-x-1/2 w-8 bottom-0.5 h-0.5 rounded-full bg-foreground/0 group-hover/block:bg-foreground/20 group-hover/resize-bottom:!bg-primary/50 transition-colors" />
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => setAddingNote(true)}>
          <StickyNote className="h-4 w-4" />
          Add note
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
