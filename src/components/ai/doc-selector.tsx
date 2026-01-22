"use client";

import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { Doc } from "@/types";

interface DocSelectorProps {
  docs: Doc[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}

export function DocSelector({
  docs,
  selectedIds,
  onToggle,
  disabled,
}: DocSelectorProps) {
  const selectedCount = selectedIds.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={disabled || docs.length === 0}
        >
          <Plus className="h-4 w-4" />
          Context
          {selectedCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {selectedCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Select docs for context</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {docs.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No docs available
          </div>
        ) : (
          docs.map((doc) => (
            <DropdownMenuCheckboxItem
              key={doc.id}
              checked={selectedIds.includes(doc.id)}
              onCheckedChange={() => onToggle(doc.id)}
            >
              <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="truncate">{doc.title}</span>
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
