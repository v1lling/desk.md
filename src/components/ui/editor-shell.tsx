"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface EditorShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  /** Optional content to render in fullscreen mode instead of children */
  fullscreenChildren?: React.ReactNode;
  /** Optional footer to render in fullscreen mode instead of footer */
  fullscreenFooter?: React.ReactNode;
  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
}

/**
 * EditorShell - A unified panel/fullscreen editor container
 *
 * Animation flow:
 * 1. Opening: Panel slides in from right
 * 2. Expand to fullscreen: Panel smoothly scales/transforms to fill screen
 * 3. Collapse from fullscreen: Scales back to panel position (NO slide-in)
 * 4. Closing: Panel slides out to right
 *
 * Uses a single container approach with CSS transitions for smooth animations.
 */
export function EditorShell({
  open,
  onClose,
  title,
  children,
  footer,
  fullscreenChildren,
  fullscreenFooter,
  onExpandedChange,
}: EditorShellProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mainElement, setMainElement] = useState<HTMLElement | null>(null);

  // Content to render based on mode
  const contentToRender = isExpanded && fullscreenChildren ? fullscreenChildren : children;
  const footerToRender = isExpanded && fullscreenFooter ? fullscreenFooter : footer;

  // Find the main element for portal rendering
  useEffect(() => {
    const main = document.querySelector("main");
    setMainElement(main as HTMLElement);
  }, []);

  // Handle open/close with slide animation
  useEffect(() => {
    if (open) {
      // Opening: make visible, then trigger animation
      setIsVisible(true);
      // Small delay to ensure DOM is ready for transition
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else {
      // Closing: trigger animation, then hide
      setIsAnimating(false);
      setIsExpanded(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Handle expand/collapse
  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + Shift + F
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        handleToggleExpand();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleToggleExpand]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Notify parent of expanded state changes
  useEffect(() => {
    onExpandedChange?.(isExpanded);
  }, [isExpanded, onExpandedChange]);

  const toggleButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggleExpand}
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

  if (!isVisible || !mainElement) return null;

  // Single container that transforms between panel and fullscreen
  return createPortal(
    <>
      {/* Backdrop - only visible in fullscreen or during any animation */}
      <div
        className={cn(
          "absolute inset-0 z-40 bg-black/50 transition-opacity duration-300",
          isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Main container - transforms between panel and fullscreen */}
      <div
        className={cn(
          "absolute z-50 bg-background flex flex-col shadow-xl transition-all duration-300 ease-out",
          // Panel mode: right side, fixed width
          !isExpanded && "top-0 bottom-0 right-0 w-full sm:max-w-2xl border-l border-border/60",
          // Fullscreen mode: fill the container
          isExpanded && "inset-0",
          // Slide animation for open/close (only when not expanded)
          !isExpanded && !isAnimating && "translate-x-full",
          !isExpanded && isAnimating && "translate-x-0",
          // Ensure no transform in fullscreen
          isExpanded && "translate-x-0"
        )}
      >
        {/* Header */}
        <header
          className={cn(
            "flex items-center justify-between border-b border-border/60 shrink-0 transition-all duration-300",
            isExpanded ? "px-4 py-3" : "px-6 pb-4 pt-6"
          )}
        >
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div
            className={cn(
              "h-full transition-all duration-300",
              isExpanded ? "max-w-6xl mx-auto px-4 py-4" : "px-6 py-6"
            )}
          >
            {contentToRender}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 shrink-0">
          <div
            className={cn(
              "transition-all duration-300",
              isExpanded ? "max-w-6xl mx-auto px-4 py-3" : "px-6 pt-4 pb-6"
            )}
          >
            {footerToRender}
          </div>
        </div>
      </div>
    </>,
    mainElement
  );
}
