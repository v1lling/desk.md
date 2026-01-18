"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold truncate">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate -mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && (
        <Button size="sm" onClick={action.onClick}>
          <Plus className="h-4 w-4 mr-2" />
          {action.label}
        </Button>
      )}
    </header>
  );
}
