"use client";

/**
 * @deprecated Use RichTextEditor from "@/components/ui/rich-text-editor" instead.
 * This file provides backwards compatibility re-exports.
 */

export { RichTextEditor as MarkdownEditor } from "./rich-text-editor";

// Keep the MarkdownPreview for read-only displays if needed
import { cn } from "@/lib/utils";

/**
 * Render markdown text to React elements (for read-only preview)
 * Supports: headers, lists, checkboxes, numbered lists, bold text
 */
export function renderMarkdown(text: string) {
  return text.split("\n").map((line, i) => {
    // Headers
    if (line.startsWith("### ")) {
      return (
        <h3 key={i} className="text-lg font-semibold mt-4 mb-2">
          {line.slice(4)}
        </h3>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h2 key={i} className="text-xl font-semibold mt-4 mb-2">
          {line.slice(3)}
        </h2>
      );
    }
    if (line.startsWith("# ")) {
      return (
        <h1 key={i} className="text-2xl font-bold mt-4 mb-2">
          {line.slice(2)}
        </h1>
      );
    }
    // Checkbox list items (unchecked)
    if (line.startsWith("- [ ] ")) {
      return (
        <div key={i} className="flex items-center gap-2 ml-4">
          <input type="checkbox" disabled className="rounded" />
          <span>{line.slice(6)}</span>
        </div>
      );
    }
    // Checkbox list items (checked)
    if (line.startsWith("- [x] ")) {
      return (
        <div key={i} className="flex items-center gap-2 ml-4">
          <input type="checkbox" checked disabled className="rounded" />
          <span className="line-through text-muted-foreground">
            {line.slice(6)}
          </span>
        </div>
      );
    }
    // Unordered list items
    if (line.startsWith("- ")) {
      return (
        <li key={i} className="ml-4">
          {line.slice(2)}
        </li>
      );
    }
    // Numbered list items
    const numberedMatch = line.match(/^(\d+)\. (.*)$/);
    if (numberedMatch) {
      return (
        <li key={i} className="ml-4 list-decimal">
          {numberedMatch[2]}
        </li>
      );
    }
    // Bold text
    const boldRegex = /\*\*(.*?)\*\*/g;
    if (boldRegex.test(line)) {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={i} className="my-1">
          {parts.map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={j}>{part.slice(2, -2)}</strong>
            ) : (
              part
            )
          )}
        </p>
      );
    }
    // Empty line
    if (line.trim() === "") {
      return <br key={i} />;
    }
    // Regular paragraph
    return (
      <p key={i} className="my-1">
        {line}
      </p>
    );
  });
}

/**
 * Markdown preview component - renders markdown content in a styled container
 */
export function MarkdownPreview({
  content,
  className,
  minHeight = "300px",
}: {
  content: string;
  className?: string;
  minHeight?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none p-4 border border-border/60 rounded-lg bg-muted/20",
        className
      )}
      style={{ minHeight }}
    >
      {renderMarkdown(content)}
    </div>
  );
}
