/**
 * TaskPickerPopover — Inline picker to add tasks or freetext notes to a workspace block.
 * Shows workspace tasks pre-filtered, with Enter on empty results adding as a note.
 */

import { useState, useMemo, useRef } from "react";
import { Plus } from "lucide-react";
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
  const listRef = useRef<HTMLDivElement>(null);

  const availableTasks = useMemo(
    () =>
      allTasks.filter(
        (t) =>
          t.workspaceId === workspaceId && !assignedTaskIds.includes(t.id)
      ),
    [allTasks, workspaceId, assignedTaskIds]
  );

  const handleSelect = (taskId: string) => {
    onSelectTask(taskId);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      // Check if there are any visible (matching) items
      const items = listRef.current?.querySelectorAll("[cmdk-item]");
      const hasVisibleItems = items && items.length > 0;

      if (!hasVisibleItems) {
        e.preventDefault();
        onAddNote(query.trim());
        setQuery("");
        setOpen(false);
      }
    }
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
        <Command shouldFilter>
          <CommandInput
            placeholder={t("pages.planner.taskPicker.placeholder")}
            value={query}
            onValueChange={setQuery}
            onKeyDown={handleKeyDown}
            className="h-9 text-xs"
          />
          <CommandList ref={listRef} className="max-h-[200px]">
            <CommandEmpty className="py-3 text-center text-[11px] text-muted-foreground">
              {query.trim()
                ? t("pages.planner.taskPicker.pressEnterAsNote")
                : t("pages.planner.taskPicker.noAvailableTasks")}
            </CommandEmpty>
            {availableTasks.length > 0 && (
              <CommandGroup>
                {availableTasks.map((task) => (
                  <CommandItem
                    key={task.id}
                    value={task.title}
                    onSelect={() => handleSelect(task.id)}
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
