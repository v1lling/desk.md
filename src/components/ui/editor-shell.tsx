"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, X } from "lucide-react";
import { createPortal } from "react-dom";

interface EditorShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function EditorShell({
  open,
  onClose,
  title,
  children,
  footer,
}: EditorShellProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mainElement, setMainElement] = useState<HTMLElement | null>(null);

  // Find the main element for portal rendering
  useEffect(() => {
    const main = document.querySelector("main");
    setMainElement(main as HTMLElement);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + Shift + F
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        setIsExpanded((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Reset to panel mode when closed
  useEffect(() => {
    if (!open) setIsExpanded(false);
  }, [open]);

  // Handle escape key in expanded mode
  useEffect(() => {
    if (!open || !isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isExpanded, onClose]);

  const toggleButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setIsExpanded(!isExpanded)}
      className="h-8 w-8"
      title={
        isExpanded ? "Collapse to panel (Cmd+Shift+F)" : "Expand (Cmd+Shift+F)"
      }
    >
      {isExpanded ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </Button>
  );

  // Expanded view: renders inside main element, fills it completely
  if (isExpanded && open && mainElement) {
    return createPortal(
      <div className="absolute inset-0 z-50 bg-background flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/60 shrink-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="flex items-center gap-1">
            {toggleButton}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Content - centered with max width for readability */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-6">{children}</div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 shrink-0">
          <div className="max-w-4xl mx-auto px-6 py-4">{footer}</div>
        </div>
      </div>,
      mainElement
    );
  }

  // Panel view: standard Sheet from right side
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col px-0" showCloseButton={false}>
        <SheetHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/60 px-6">
          <SheetTitle>{title}</SheetTitle>
          <div className="flex items-center gap-1">
            {toggleButton}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6 px-6">{children}</div>

        <div className="border-t border-border/60 pt-4 px-6 pb-6">{footer}</div>
      </SheetContent>
    </Sheet>
  );
}
