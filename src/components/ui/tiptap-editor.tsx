"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

/**
 * Convert Tiptap JSON content to markdown string
 */
function htmlToMarkdown(html: string): string {
  if (!html || html === "<p></p>") return "";

  let markdown = html;

  // Headers
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n");
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n");
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n");

  // Bold and italic
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  markdown = markdown.replace(/<s[^>]*>(.*?)<\/s>/gi, "~~$1~~");
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");

  // Links
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

  // Task lists (must be before regular lists)
  markdown = markdown.replace(
    /<ul[^>]*data-type="taskList"[^>]*>([\s\S]*?)<\/ul>/gi,
    (_, content) => {
      return content
        .replace(/<li[^>]*data-checked="true"[^>]*><label[^>]*>.*?<\/label><div[^>]*><p[^>]*>(.*?)<\/p><\/div><\/li>/gi, "- [x] $1\n")
        .replace(/<li[^>]*data-checked="false"[^>]*><label[^>]*>.*?<\/label><div[^>]*><p[^>]*>(.*?)<\/p><\/div><\/li>/gi, "- [ ] $1\n")
        .replace(/<li[^>]*data-checked="true"[^>]*>(.*?)<\/li>/gi, "- [x] $1\n")
        .replace(/<li[^>]*data-checked="false"[^>]*>(.*?)<\/li>/gi, "- [ ] $1\n");
    }
  );

  // Unordered lists
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    return content.replace(/<li[^>]*><p[^>]*>(.*?)<\/p><\/li>/gi, "- $1\n")
                  .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  });

  // Ordered lists
  let listIndex = 0;
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_: string, content: string) => {
    listIndex = 0;
    return content.replace(/<li[^>]*><p[^>]*>(.*?)<\/p><\/li>/gi, () => `${++listIndex}. $1\n`)
                  .replace(/<li[^>]*>(.*?)<\/li>/gi, (_match: string, text: string) => `${++listIndex}. ${text}\n`);
  });

  // Blockquotes
  markdown = markdown.replace(/<blockquote[^>]*><p[^>]*>(.*?)<\/p><\/blockquote>/gi, "> $1\n");
  markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, "> $1\n");

  // Code blocks
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "```\n$1\n```\n");

  // Horizontal rules
  markdown = markdown.replace(/<hr[^>]*\/?>/gi, "\n---\n");

  // Paragraphs - convert to newlines
  markdown = markdown.replace(/<p[^>]*><\/p>/gi, "\n");
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n");

  // Line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, "\n");

  // Clean up any remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  markdown = markdown
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Clean up extra newlines
  markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();

  return markdown;
}

/**
 * Convert markdown string to HTML for Tiptap
 */
function markdownToHtml(markdown: string): string {
  if (!markdown) return "<p></p>";

  let html = markdown;

  // Escape HTML entities first
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (before other processing)
  html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // Inline code (before other inline processing)
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headers (must be at start of line)
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr>");

  // Bold and italic (order matters)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Task list items
  html = html.replace(/^- \[x\] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>$1</p></li></ul>');
  html = html.replace(/^- \[ \] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>$1</p></li></ul>');

  // Regular list items
  html = html.replace(/^- (.+)$/gm, "<ul><li><p>$1</p></li></ul>");
  html = html.replace(/^\d+\. (.+)$/gm, "<ol><li><p>$1</p></li></ol>");

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote><p>$1</p></blockquote>");

  // Merge consecutive lists
  html = html.replace(/<\/ul>\s*<ul>/g, "");
  html = html.replace(/<\/ul>\s*<ul data-type="taskList">/g, "");
  html = html.replace(/<\/ol>\s*<ol>/g, "");

  // Convert remaining lines to paragraphs (skip empty lines and already-wrapped content)
  const lines = html.split("\n");
  html = lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "<p></p>";
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<li") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<hr") ||
        trimmed.startsWith("<p")
      ) {
        return line;
      }
      return `<p>${trimmed}</p>`;
    })
    .join("");

  return html || "<p></p>";
}

export function TiptapEditor({
  value,
  onChange,
  placeholder = "Write in markdown...",
  className,
  minHeight = "200px",
}: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
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
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2",
        },
      }),
    ],
    content: markdownToHtml(value),
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
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onChange(markdown);
    },
  });

  // Update editor content when value changes externally
  useEffect(() => {
    if (editor && value !== htmlToMarkdown(editor.getHTML())) {
      const html = markdownToHtml(value);
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [value, editor]);

  // Handle markdown shortcuts as user types
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

// Export for backwards compatibility during transition
export { TiptapEditor as MarkdownEditor };
