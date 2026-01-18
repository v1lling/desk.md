"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  defaultTab?: "edit" | "preview";
  minHeight?: string;
}

/**
 * Render markdown text to React elements
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

/**
 * Full markdown editor with Edit/Preview tabs
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write in markdown...",
  className,
  defaultTab = "edit",
  minHeight = "300px",
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "preview">(defaultTab);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "edit" | "preview")}
      className={cn("flex flex-col", className)}
    >
      <TabsList className="w-fit">
        <TabsTrigger value="edit" className="gap-2">
          <Edit2 className="h-3 w-3" />
          Edit
        </TabsTrigger>
        <TabsTrigger value="preview" className="gap-2">
          <Eye className="h-3 w-3" />
          Preview
        </TabsTrigger>
      </TabsList>

      <TabsContent value="edit" className="flex-1 mt-4">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-full resize-none font-mono text-sm"
          style={{ minHeight }}
          placeholder={placeholder}
        />
      </TabsContent>

      <TabsContent value="preview" className="flex-1 mt-4 overflow-auto">
        <MarkdownPreview content={value} minHeight={minHeight} />
      </TabsContent>
    </Tabs>
  );
}
