"use client";

import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Header({ title, subtitle, action }: HeaderProps) {
  const openSearch = () => {
    // Trigger the Cmd+K shortcut programmatically
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold truncate">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate -mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={openSearch}
          className="hidden sm:flex items-center gap-2 text-muted-foreground"
        >
          <Search className="h-4 w-4" />
          <span>Search</span>
          <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 hidden sm:inline-flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
        {action && (
          <Button size="sm" onClick={action.onClick}>
            <Plus className="h-4 w-4 mr-2" />
            {action.label}
          </Button>
        )}
      </div>
    </header>
  );
}
