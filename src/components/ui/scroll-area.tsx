"use client";

import * as React from "react";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import { cn } from "@/lib/utils";

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  /** Direction of scroll. Defaults to "vertical" */
  orientation?: "vertical" | "horizontal" | "both";
  /** Position of horizontal scrollbar. Defaults to "bottom" */
  horizontalScrollbarPosition?: "top" | "bottom";
}

/**
 * Custom scroll area using OverlayScrollbars.
 * Works on all platforms including Tauri/WKWebView on macOS.
 *
 * Usage: Wrap scrollable content. In flex containers, use with flex-1.
 * Theme defined in globals.css (.os-theme-desk).
 */
function ScrollArea({
  children,
  className,
  orientation = "vertical",
  horizontalScrollbarPosition = "bottom",
  ...props
}: ScrollAreaProps) {
  return (
    <OverlayScrollbarsComponent
      data-slot="scroll-area"
      className={cn(
        "overflow-hidden",
        horizontalScrollbarPosition === "top" && "os-scrollbar-top",
        className
      )}
      options={{
        scrollbars: {
          theme: "os-theme-desk",
          autoHide: "never",
          clickScroll: true,
        },
        overflow: {
          x: orientation === "horizontal" || orientation === "both" ? "scroll" : "hidden",
          y: orientation === "vertical" || orientation === "both" ? "scroll" : "hidden",
        },
      }}
      defer
      {...props}
    >
      {children}
    </OverlayScrollbarsComponent>
  );
}

export { ScrollArea };
