
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Markdown } from "tiptap-markdown";
import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NoteLinkPicker } from "@/components/ui/note-link-picker";
import { SlashCommands } from "@/components/ui/slash-commands";
import { isTauri } from "@/lib/desk/tauri-fs";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { parseNoteLinkHref, createNoteLinkHref, type NoteLink, type NoteLinkType } from "@/lib/desk/note-link";
import type { SearchItemType } from "@/lib/desk/search-index";

// Zero-width space marker for empty paragraphs — preserves blank lines through
// the markdown serialization roundtrip. Must match the marker in use-editor-session.ts.
const EMPTY_PARA_MARKER = '\u200B';

// Custom paragraph that writes a zero-width space for empty paragraphs so
// getMarkdown() doesn't collapse consecutive blank lines into one.
const CustomParagraph = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          if (node.content.size === 0) {
            state.write(EMPTY_PARA_MARKER);
          } else {
            state.renderInline(node);
          }
          state.closeBlock(node);
        },
        parse: {
          // handled by markdown-it
        },
      },
    };
  },
});

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  onInternalLinkClick?: (link: NoteLink) => void;
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
  onInternalLinkClick,
}: RichTextEditorProps) {
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  // Track if we're currently syncing to avoid loops
  const isSyncing = useRef(false);
  // Track programmatic updates to prevent onChange from firing
  const isProgrammaticUpdate = useRef(false);
  // Ref to latest onInternalLinkClick so the ProseMirror handler always has the current callback
  const onInternalLinkClickRef = useRef(onInternalLinkClick);
  onInternalLinkClickRef.current = onInternalLinkClick;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        paragraph: false,
      }),
      CustomParagraph,
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Link.configure({
        openOnClick: false,
        protocols: ['desk'],
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
      SlashCommands,
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
      handleDOMEvents: {
        click: (_view, event) => {
          const target = event.target as HTMLElement;
          const link = target.closest('a');
          if (link?.getAttribute('href')) {
            event.preventDefault();
            const href = link.getAttribute('href')!;

            // Internal note link (desk://type/id)
            const noteLink = parseNoteLinkHref(href);
            if (noteLink) {
              onInternalLinkClickRef.current?.(noteLink);
              return true;
            }

            // External URL
            if (isTauri()) {
              openUrl(href);
            } else {
              window.open(href, '_blank', 'noopener,noreferrer');
            }
            return true;
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      // Skip onChange for programmatic updates (e.g., external value sync)
      // This prevents tiptap-markdown's getMarkdown() from overwriting the original
      // value with normalized content (which may trim whitespace)
      if (isProgrammaticUpdate.current) return;

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
      // Mark as programmatic update to prevent onUpdate from calling onChange
      // This preserves the original value (including whitespace) instead of
      // letting tiptap-markdown normalize it
      isProgrammaticUpdate.current = true;
      // Save selection
      const { from, to } = editor.state.selection;
      editor.commands.setContent(value);
      // Restore selection if possible (and if not drastically changed)
      if (from <= editor.state.doc.content.size) {
        editor.commands.setTextSelection({ from, to });
      }
      // Reset flag after a microtask to ensure onUpdate has fired
      queueMicrotask(() => {
        isProgrammaticUpdate.current = false;
      });
    }
  }, [value, editor]);

  // Listen for slash-command link picker trigger
  useEffect(() => {
    const handleOpenLinkPicker = () => setShowLinkPicker(true);
    window.addEventListener("slash-command:open-link-picker", handleOpenLinkPicker);
    return () => {
      window.removeEventListener("slash-command:open-link-picker", handleOpenLinkPicker);
    };
  }, []);

  // Prevent event bubbling (avoids triggering drag/sort handlers)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  // Insert a note link at cursor position
  const handleNoteLinkSelect = useCallback(
    (item: { type: SearchItemType; id: string; title: string }) => {
      if (!editor) return;
      const href = createNoteLinkHref(item.type as NoteLinkType, item.id);
      const { from, to } = editor.state.selection;
      const hasSelection = from !== to;

      if (hasSelection) {
        editor.chain().focus().setLink({ href }).run();
      } else {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "text",
            text: item.title,
            marks: [{ type: "link", attrs: { href } }],
          })
          .run();
      }
    },
    [editor]
  );

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
        <div className="p-4" onKeyDown={handleKeyDown}>
          <EditorContent editor={editor} />
        </div>
      </ScrollArea>
      <NoteLinkPicker
        open={showLinkPicker}
        onOpenChange={setShowLinkPicker}
        onSelect={handleNoteLinkSelect}
      />
    </div>
  );
}
