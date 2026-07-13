/**
 * TaskPickerPopover — Inline picker to add tasks or freetext notes to a workspace block.
 * Shows workspace tasks pre-filtered, with Enter on empty results adding as a note.
 */

import { useState, useMemo } from "react";
import { Plus, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { taskStatusColors } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import type { ActiveTask } from "@desk/core";

interface TaskPickerPopoverProps {
  workspaceId: string;
  allTasks: ActiveTask[];
  assignedTaskIds: string[];
  onSelectTask: (taskId: string) => void;
  onAddNote: (note: string) => void;
}

export function TaskPickerPopover({
  workspaceId,
  allTasks,
  assignedTaskIds,
  onSelectTask,
  onAddNote,
}: TaskPickerPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const trimmed = query.trim();

  // Filtering is ours, not cmdk's (`shouldFilter={false}` below, as in global search
  // and the note-link picker). cmdk's built-in filter scores fuzzy *subsequences*, so
  // typing "mia" matched "Mail an Fitness App" — plain substring is what people expect
  // here, and it lets a genuinely new word like "Mia" fall through to a note.
  //
  // `allTasks` carries every status so blocks can keep showing finished work, but there
  // is no point planning a task that is already done.
  const matchingTasks = useMemo(() => {
    const needle = trimmed.toLowerCase();
    return allTasks.filter(
      (task) =>
        task.workspaceId === workspaceId &&
        task.status !== "done" &&
        !assignedTaskIds.includes(task.id) &&
        (!needle || task.title.toLowerCase().includes(needle))
    );
  }, [allTasks, workspaceId, assignedTaskIds, trimmed]);

  const handleSelectTask = (taskId: string) => {
    onSelectTask(taskId);
    setQuery("");
    setOpen(false);
  };

  const handleSelectNote = () => {
    if (!trimmed) return;
    onAddNote(trimmed);
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full py-1 rounded text-[11px] text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 transition-colors flex items-center justify-center gap-1">
          <Plus className="h-3 w-3" />
          {t("common.buttons.add")}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("pages.planner.taskPicker.placeholder")}
            value={query}
            onValueChange={setQuery}
            className="h-9 text-xs"
          />
          <CommandList className="max-h-[200px]">
            {matchingTasks.length === 0 && !trimmed && (
              <CommandEmpty className="py-3 text-center text-[11px] text-muted-foreground">
                {t("pages.planner.taskPicker.noAvailableTasks")}
              </CommandEmpty>
            )}
            {matchingTasks.length > 0 && (
              <CommandGroup>
                {matchingTasks.map((task) => (
                  <CommandItem
                    key={task.id}
                    value={`task:${task.id}`}
                    onSelect={() => handleSelectTask(task.id)}
                    className="flex items-center gap-1.5 text-xs cursor-pointer"
                  >
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        taskStatusColors[task.status]
                      )}
                    />
                    <span className="truncate">{task.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {/* Adding a note stays reachable even when tasks match the query */}
            {trimmed && (
              <>
                {matchingTasks.length > 0 && <CommandSeparator />}
                <CommandGroup>
                  <CommandItem
                    value="add-as-note"
                    onSelect={handleSelectNote}
                    className="flex items-center gap-1.5 text-xs cursor-pointer"
                  >
                    <StickyNote className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate text-muted-foreground">
                      {t("pages.planner.taskPicker.addAsNote", { text: trimmed })}
                    </span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
