"use client";

import { useState } from "react";
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
import { Loader2 } from "lucide-react";
import { useCreateArea } from "@/stores/areas";
import { useSettingsStore } from "@/stores/settings";
import { slugify } from "@/lib/orbit/parser";
import { toast } from "sonner";
import { areaColorOptions } from "@/lib/design-tokens";

interface NewAreaModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewAreaModal({ open, onClose }: NewAreaModalProps) {
  const createArea = useCreateArea();
  const setCurrentAreaId = useSettingsStore((state) => state.setCurrentAreaId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(areaColorOptions[0].value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    const id = slugify(name.trim());

    try {
      const newArea = await createArea.mutateAsync({
        id,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });

      toast.success("Area created");

      // Switch to the new area
      setCurrentAreaId(newArea.id);

      // Reset form
      setName("");
      setDescription("");
      setColor(areaColorOptions[0].value);
      onClose();
    } catch (error) {
      console.error("Failed to create area:", error);
      toast.error("Failed to create area");
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setColor(areaColorOptions[0].value);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Area</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="area-name">Area Name</Label>
            <Input
              id="area-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Client Name or Workspace"
              autoFocus
            />
            {name && (
              <p className="text-xs text-muted-foreground">
                Folder: ~/Orbit/areas/{slugify(name.trim()) || "..."}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="area-description">Description (optional)</Label>
            <Textarea
              id="area-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this area..."
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {areaColorOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setColor(opt.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === opt.value
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: opt.value }}
                  title={opt.label}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createArea.isPending}>
              {createArea.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Area
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
