/**
 * AddBlockButton — Click to pick a workspace, instantly creates a block
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePlannerStore } from "@/stores/planner";
import { useWorkspaces } from "@/stores/workspaces";

interface AddBlockButtonProps {
  date: string;
  weekOf: string;
}

export function AddBlockButton({ date, weekOf }: AddBlockButtonProps) {
  const [open, setOpen] = useState(false);
  const { data: workspaces = [] } = useWorkspaces();
  const addBlock = usePlannerStore((s) => s.addBlock);

  const handleSelect = (workspaceId: string) => {
    addBlock(weekOf, date, {
      id: crypto.randomUUID(),
      workspaceId,
      taskIds: [],
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full py-1.5 rounded-lg border border-dashed border-muted-foreground/20 text-[11px] text-muted-foreground/60 hover:border-muted-foreground/40 hover:text-muted-foreground transition-colors">
          <Plus className="h-3 w-3 inline-block mr-1" />
          Add block
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => handleSelect(ws.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted/60 transition-colors"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: ws.color || "#64748b" }}
            />
            {ws.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
