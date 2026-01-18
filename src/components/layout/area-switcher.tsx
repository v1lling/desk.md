"use client";

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
import { useAreas, useCurrentArea } from "@/stores/areas";
import { useSettingsStore } from "@/stores/settings";
import { NewAreaModal } from "@/components/areas/new-area-modal";

interface AreaSwitcherProps {
  collapsed?: boolean;
}

export function AreaSwitcher({ collapsed = false }: AreaSwitcherProps) {
  const { data: areas = [], isLoading } = useAreas();
  const currentArea = useCurrentArea();
  const setCurrentAreaId = useSettingsStore((state) => state.setCurrentAreaId);
  const [showNewAreaModal, setShowNewAreaModal] = useState(false);

  const handleSelectArea = (areaId: string) => {
    setCurrentAreaId(areaId);
  };

  if (isLoading || !currentArea) {
    return null;
  }

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="w-10 h-10">
            <Circle
              className="h-5 w-5"
              style={{ color: currentArea.color }}
              fill={currentArea.color}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {areas.map((area) => (
            <DropdownMenuItem
              key={area.id}
              className="gap-2"
              onClick={() => handleSelectArea(area.id)}
            >
              <Circle
                className="h-3 w-3"
                style={{ color: area.color }}
                fill={area.color}
              />
              {area.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2" onClick={() => setShowNewAreaModal(true)}>
            <Plus className="h-3 w-3" />
            New Area
          </DropdownMenuItem>
        </DropdownMenuContent>
        <NewAreaModal open={showNewAreaModal} onClose={() => setShowNewAreaModal(false)} />
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-3 h-10"
        >
          <div className="flex items-center gap-2">
            <Circle
              className="h-3 w-3"
              style={{ color: currentArea.color }}
              fill={currentArea.color}
            />
            <span className="font-semibold">{currentArea.name}</span>
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {areas.map((area) => (
          <DropdownMenuItem
            key={area.id}
            className={cn(
              "gap-2 cursor-pointer",
              area.id === currentArea.id && "bg-accent"
            )}
            onClick={() => handleSelectArea(area.id)}
          >
            <Circle
              className="h-3 w-3"
              style={{ color: area.color }}
              fill={area.color}
            />
            {area.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setShowNewAreaModal(true)}>
          <Plus className="h-3 w-3" />
          New Area
        </DropdownMenuItem>
      </DropdownMenuContent>
      <NewAreaModal open={showNewAreaModal} onClose={() => setShowNewAreaModal(false)} />
    </DropdownMenu>
  );
}
