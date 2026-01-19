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

// Default color when area has no color set
const DEFAULT_AREA_COLOR = "#64748b"; // slate-500

// Color indicator dot for areas
function AreaDot({ color, size = "sm" }: { color?: string; size?: "sm" | "lg" }) {
  const fillColor = color || DEFAULT_AREA_COLOR;
  return (
    <Circle
      className={size === "lg" ? "size-5" : "size-3"}
      style={{ color: fillColor }}
      fill={fillColor}
    />
  );
}

export function AreaSwitcher({ collapsed = false }: AreaSwitcherProps) {
  const { data: areas = [], isLoading } = useAreas();
  const currentArea = useCurrentArea();
  const setCurrentAreaId = useSettingsStore((state) => state.setCurrentAreaId);
  const [showNewAreaModal, setShowNewAreaModal] = useState(false);

  if (isLoading || !currentArea) {
    return null;
  }

  // Shared dropdown content - avoids duplication between collapsed/expanded states
  const dropdownContent = (
    <DropdownMenuContent align="start" className={collapsed ? "w-48" : "w-56"}>
      {areas.map((area) => (
        <DropdownMenuItem
          key={area.id}
          className={cn("gap-2", area.id === currentArea.id && "bg-accent")}
          onClick={() => setCurrentAreaId(area.id)}
        >
          <AreaDot color={area.color} />
          {area.name}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="gap-2"
        onClick={() => setShowNewAreaModal(true)}
      >
        <Plus className="size-3" />
        New Area
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {collapsed ? (
            <Button variant="ghost" size="icon" className="size-10">
              <AreaDot color={currentArea.color} size="lg" />
            </Button>
          ) : (
            <Button variant="ghost" className="w-full justify-between px-3 h-10">
              <div className="flex items-center gap-2">
                <AreaDot color={currentArea.color} />
                <span className="font-semibold">{currentArea.name}</span>
              </div>
              <ChevronsUpDown className="size-4 opacity-50" />
            </Button>
          )}
        </DropdownMenuTrigger>
        {dropdownContent}
      </DropdownMenu>

      <NewAreaModal
        open={showNewAreaModal}
        onClose={() => setShowNewAreaModal(false)}
      />
    </>
  );
}
