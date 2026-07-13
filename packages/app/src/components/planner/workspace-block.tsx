/**
 * TimeBlock — Time-positioned workspace block with resize handles and drag support.
 * Absolutely positioned within a day column based on startMinute/endMinute.
 * Content adapts to block height: compact for short blocks, full for tall ones.
 */

import { useState, useMemo, useCallback, useRef } from "react";
import { Circle, StickyNote, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  pixelsToMinutes,
  snapToSlot,
  blocksOverlap,
} from "@desk/core";
import { MiniTaskItem } from "./mini-task-item";
import { MiniNoteItem } from "./mini-note-item";
import { TaskPickerPopover } from "./task-picker-popover";
import { usePointerDrag } from "./use-pointer-drag";
import type { WorkspaceBlock, Workspace } from "@desk/core/types";
import type { ActiveTask } from "@desk/core";

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
  /** A task from the rail is hovering over this block and would drop into it. */
  isDropTarget?: boolean;
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
  isDropTarget,
}: TimeBlockProps) {
  const { t } = useTranslation();
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

  const beginDrag = usePointerDrag();

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

      beginDrag(e, {
        cursor: "ns-resize",
        onMove: (ev) => {
          if (!resizeRef.current) return;
          const deltaMinutes = pixelsToMinutes(
            ev.clientY - resizeRef.current.startY,
            slotHeightRef.current
          );

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
        },
        onEnd: () => {
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
        },
        onCancel: () => {
          setResizePreview(null);
          resizeRef.current = null;
        },
      });
    },
    [beginDrag, block, weekOf, day, updateBlockTime, clampToSiblings]
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
            resizePreview && "shadow-lg ring-1 ring-primary/20",
            isDropTarget && "ring-1 ring-primary/40 shadow-md"
          )}
          style={{
            top,
            height,
            borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
            backgroundColor: `color-mix(in srgb, ${color} 8%, var(--color-card))`,
            zIndex: resizePreview ? 20 : 10,
          }}
          data-block
          data-block-id={block.id}
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

            {/* Notes + tasks — medium and full.
                One region that owns the space between header and footer. `safe center`
                centres the contents while they fit, so a lone note is not squashed up
                against the workspace name, and degrades to top-aligned (rather than
                clipping the first row) once they overflow. */}
            {!isCompact && (
              <div
                className="flex-1 min-h-0 overflow-hidden flex flex-col gap-0.5 py-0.5"
                style={{ justifyContent: "safe center" }}
              >
                {block.notes && block.notes.length > 0 && (
                  <div className="space-y-0.5 shrink-0" data-no-drag>
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
                        {t("pages.planner.block.moreCount", { count: block.notes.length - 2 })}
                      </span>
                    )}
                  </div>
                )}

                {addingNote && (
                  <div className="shrink-0" data-no-drag>
                    <input
                      type="text"
                      className="w-full text-xs px-1.5 py-1 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                      placeholder={t("pages.planner.block.notePlaceholder")}
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

                {tasks.length > 0 && (
                  <div className="space-y-0.5 shrink-0">
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
                        {t("pages.planner.block.moreCount", { count: tasks.length - 3 })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Footer — task picker (full only) above the time label */}
            {!isCompact && (
              <div className="shrink-0">
                {!isMedium && (
                  <div data-no-drag>
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
                <span className="block text-[10px] text-muted-foreground/50 pt-0.5">
                  {timeLabel}
                </span>
              </div>
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
          {t("pages.planner.block.addNote")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          {t("pages.planner.block.removeBlock")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
