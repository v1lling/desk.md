"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
// Link extension is provided by tiptap-markdown, so we don't need to import it separately
import { Markdown } from "tiptap-markdown";
import { useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function TiptapEditor({
  value,
  onChange,
  placeholder = "Write in markdown...",
  className,
  minHeight = "200px",
}: TiptapEditorProps) {
  // Track if we're currently syncing to avoid loops
  const isSyncing = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        // Disable default bullet/ordered list to avoid conflicts
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Markdown.configure({
        html: false,
        transformCopiedText: true,
        transformPastedText: true,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
          "prose-headings:font-semibold prose-headings:tracking-tight",
          "prose-h1:text-2xl prose-h1:mt-6 prose-h1:mb-4",
          "prose-h2:text-xl prose-h2:mt-5 prose-h2:mb-3",
          "prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2",
          "prose-p:my-2 prose-p:leading-relaxed",
          "prose-ul:my-2 prose-ol:my-2",
          "prose-li:my-0.5",
          "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none",
          "prose-pre:bg-muted prose-pre:rounded-lg",
          "prose-blockquote:border-l-2 prose-blockquote:border-muted-foreground/30 prose-blockquote:pl-4 prose-blockquote:italic",
          "prose-a:text-primary prose-a:underline prose-a:underline-offset-2"
        ),
      },
    },
    onUpdate: ({ editor }) => {
      if (isSyncing.current) return;
      const storage = editor.storage as unknown as Record<string, { getMarkdown: () => string }>;
      const markdown = storage.markdown.getMarkdown();
      onChange(markdown);
    },
  });

  // Update editor content when value changes externally
  useEffect(() => {
    if (!editor) return;

    const storage = editor.storage as unknown as Record<string, { getMarkdown: () => string }>;
    const currentMarkdown = storage.markdown.getMarkdown();
    if (value !== currentMarkdown) {
      isSyncing.current = true;
      editor.commands.setContent(value);
      isSyncing.current = false;
    }
  }, [value, editor]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!editor) return;

      // Ctrl/Cmd + B for bold
      if ((event.ctrlKey || event.metaKey) && event.key === "b") {
        event.preventDefault();
        editor.chain().focus().toggleBold().run();
      }
      // Ctrl/Cmd + I for italic
      if ((event.ctrlKey || event.metaKey) && event.key === "i") {
        event.preventDefault();
        editor.chain().focus().toggleItalic().run();
      }
      // Ctrl/Cmd + ` for code
      if ((event.ctrlKey || event.metaKey) && event.key === "`") {
        event.preventDefault();
        editor.chain().focus().toggleCode().run();
      }
    },
    [editor]
  );

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-background overflow-hidden",
        className
      )}
      style={{ minHeight }}
    >
      <div
        className="p-4 h-full overflow-y-auto"
        style={{ minHeight }}
        onKeyDown={handleKeyDown}
      >
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}

// Export for backwards compatibility
export { TiptapEditor as MarkdownEditor };
