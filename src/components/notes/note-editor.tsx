"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trash2, Eye, Edit2 } from "lucide-react";
import { useUpdateNote, useDeleteNote } from "@/stores";
import type { Note } from "@/types";
import { toast } from "sonner";

interface NoteEditorProps {
  note: Note | null;
  open: boolean;
  onClose: () => void;
}

export function NoteEditor({ note, open, onClose }: NoteEditorProps) {
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setActiveTab("edit");
    }
  }, [note]);

  const handleSave = async () => {
    if (!note) return;

    try {
      await updateNote.mutateAsync({
        noteId: note.id,
        areaId: note.areaId,
        projectId: note.projectId,
        updates: {
          title: title.trim() || note.title,
          content,
        },
      });
      toast.success("Note saved");
      onClose();
    } catch {
      toast.error("Failed to save note");
    }
  };

  const handleDelete = async () => {
    if (!note) return;

    if (confirm("Are you sure you want to delete this note?")) {
      try {
        await deleteNote.mutateAsync({ noteId: note.id, areaId: note.areaId, projectId: note.projectId });
        toast.success("Note deleted");
        onClose();
      } catch {
        toast.error("Failed to delete note");
      }
    }
  };

  const handleClose = () => {
    setTitle("");
    setContent("");
    onClose();
  };

  // Simple markdown to HTML conversion for preview
  const renderMarkdown = (text: string) => {
    return text
      .split("\n")
      .map((line, i) => {
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
        // List items
        if (line.startsWith("- [ ] ")) {
          return (
            <div key={i} className="flex items-center gap-2 ml-4">
              <input type="checkbox" disabled className="rounded" />
              <span>{line.slice(6)}</span>
            </div>
          );
        }
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
        if (line.startsWith("- ")) {
          return (
            <li key={i} className="ml-4">
              {line.slice(2)}
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
  };

  if (!note) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col px-0">
        <SheetHeader className="pb-4 border-b border-border/60 space-y-1">
          <SheetTitle className="sr-only">Edit Note</SheetTitle>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold tracking-tight border-none p-0 h-auto focus-visible:ring-0"
            placeholder="Note title"
          />
          <p className="text-xs text-muted-foreground">
            Created: {note.created}
          </p>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "edit" | "preview")}
          className="flex-1 flex flex-col py-4 px-6 overflow-hidden"
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

          <TabsContent value="edit" className="flex-1 mt-4 overflow-hidden">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-full min-h-[300px] resize-none font-mono text-sm"
              placeholder="Write your note in markdown..."
            />
          </TabsContent>

          <TabsContent value="preview" className="flex-1 mt-4 overflow-auto">
            <div className="prose prose-sm dark:prose-invert max-w-none p-4 border border-border/60 rounded-lg min-h-[300px] bg-muted/20">
              {renderMarkdown(content)}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 px-6 pb-6 border-t border-border/60">
          <Button
            variant="outline"
            size="icon"
            onClick={handleDelete}
            disabled={deleteNote.isPending}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {deleteNote.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateNote.isPending}>
              {updateNote.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
