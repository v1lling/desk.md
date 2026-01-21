"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCreateDoc, useProjects, useCurrentWorkspace } from "@/stores";
import { toast } from "sonner";

interface NewDocModalProps {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
}

export function NewDocModal({
  open,
  onClose,
  defaultProjectId,
}: NewDocModalProps) {
  const currentWorkspace = useCurrentWorkspace();
  const createDoc = useCreateDoc();
  const { data: projects = [] } = useProjects(currentWorkspace?.id || null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId || "");

  useEffect(() => {
    if (defaultProjectId) {
      setProjectId(defaultProjectId);
    }
  }, [defaultProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !currentWorkspace) return;

    try {
      await createDoc.mutateAsync({
        workspaceId: currentWorkspace.id,
        projectId: projectId || "_unassigned",
        title: title.trim(),
        content: content || undefined,
      });

      toast.success("Doc created");

      // Reset form
      setTitle("");
      setContent("");
      onClose();
    } catch (error) {
      console.error("Failed to create doc:", error);
      toast.error("Failed to create doc");
    }
  };

  const handleClose = () => {
    setTitle("");
    setContent("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Doc</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Doc title"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Project <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-content">Content (optional)</Label>
            <Textarea
              id="doc-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing..."
              className="min-h-[120px] resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createDoc.isPending}
            >
              {createDoc.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Doc
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
