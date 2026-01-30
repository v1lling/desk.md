"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Markdown } from "tiptap-markdown";
import { useEffect, useCallback, useRef, MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isTauri } from "@/lib/desk/tauri-fs";
import { open as openUrl } from "@tauri-apps/plugin-shell";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

/**
 * RichTextEditor - WYSIWYG markdown editor built on Tiptap
 *
 * Features:
 * - Markdown input/output
 * - Headings, lists, task lists, tables
 * - Link support with click-to-open
 * - Code blocks
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something...",
  className,
  minHeight = "300px",
}: RichTextEditorProps) {
  // Track if we're currently syncing to avoid loops
  const isSyncing = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
          "prose-h1:text-2xl prose-h1:font-bold prose-h1:mt-6 prose-h1:mb-4",
          "prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-5 prose-h2:mb-3",
          "prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-2",
          "prose-p:my-2 prose-p:leading-relaxed",
          "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
          "prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-sm",
          "prose-ul:my-2 prose-ul:list-disc prose-ul:pl-6",
          "prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-6",
          "prose-li:my-1",
          "prose-blockquote:border-l-4 prose-blockquote:border-primary/50 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground",
          "min-h-[100px]"
        ),
      },
      handleKeyDown: (view, event) => {
        // Prevent sorting/dragging when staring to edit
        if (event.key === " ") {
          event.stopPropagation();
        }
      },
    },
    onUpdate: ({ editor }) => {
      // Get markdown content
      const storage = editor.storage as unknown as Record<string, { getMarkdown: () => string }>;
      const markdown = storage.markdown.getMarkdown();

      isSyncing.current = true;
      onChange(markdown);
      isSyncing.current = false;
    },
    content: value,
  });

  // Update editor content when value changes externally
  useEffect(() => {
    if (!editor || isSyncing.current) return;

    // Only update if content is different to avoid cursor jumps
    // Note: This is an imperfect check as markdown <-> html conversion isn't always 1:1
    // but it catches the most common case of "nothing changed"
    const storage = editor.storage as unknown as Record<string, { getMarkdown: () => string }>;
    const currentMarkdown = storage.markdown.getMarkdown();

    if (value !== currentMarkdown) {
      // Save selection
      const { from, to } = editor.state.selection;
      editor.commands.setContent(value);
      // Restore selection if possible (and if not drastically changed)
      if (from <= editor.state.doc.content.size) {
        editor.commands.setTextSelection({ from, to });
      }
    }
  }, [value, editor]);

  // Handle link clicks to open in browser
  const handleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'A' && target.getAttribute('href')) {
      event.preventDefault();
      const href = target.getAttribute('href');
      if (href) {
        if (isTauri()) {
          openUrl(href);
        } else {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
    }
  }, []);

  // Prevent drag-drop events from bubbling up to the board
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-background overflow-hidden",
        className
      )}
      style={{ minHeight }}
    >
      <ScrollArea className="h-full" style={{ minHeight }}>
        <div className="p-4" onKeyDown={handleKeyDown} onClick={handleClick}>
          <EditorContent editor={editor} />
        </div>
      </ScrollArea>
    </div>
  );
}
