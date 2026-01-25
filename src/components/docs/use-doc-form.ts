"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useUpdateDoc, useDeleteDoc, useMoveDocToProject, useProjects } from "@/stores";
import { useAutoSave } from "@/hooks/use-auto-save";
import type { Doc } from "@/types";
import { toast } from "sonner";

interface UseDocFormOptions {
  /** Whether auto-save is enabled */
  enabled: boolean;
  /** Callback when doc is deleted */
  onDeleted?: () => void;
  /** Callback when close is requested (e.g., after move & save) */
  onClose?: () => void;
}

/**
 * useDocForm - Shared state and logic for doc editing
 *
 * Handles:
 * - Form state (title, content, projectId)
 * - Auto-save
 * - Project move detection
 * - Delete with confirmation
 *
 * Used by DocEditor (tab-based editor)
 */
export function useDocForm(doc: Doc | null, options: UseDocFormOptions) {
  const { enabled, onDeleted, onClose } = options;

  const updateDoc = useUpdateDoc();
  const deleteDoc = useDeleteDoc();
  const moveDocToProject = useMoveDocToProject();
  const { data: projects = [] } = useProjects(doc?.workspaceId || null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [originalProjectId, setOriginalProjectId] = useState("");

  // Sync state when doc changes
  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setContent(doc.content);
      setProjectId(doc.projectId);
      setOriginalProjectId(doc.projectId);
      setIsEditorReady(false);
    }
  }, [doc]);

  // Defer editor rendering
  useEffect(() => {
    if (enabled && doc && !isEditorReady) {
      const frameId = requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [enabled, doc, isEditorReady]);

  // Auto-save data
  const autoSaveData = useMemo(
    () => ({ title, content }),
    [title, content]
  );

  // Auto-save handler
  const handleAutoSave = useCallback(
    async (data: { title: string; content: string }) => {
      if (!doc) return;

      await updateDoc.mutateAsync({
        doc,
        updates: {
          title: data.title.trim() || doc.title,
          content: data.content,
        },
      });
    },
    [doc, updateDoc]
  );

  // Auto-save hook
  const { status: saveStatus, save: triggerSave, isDirty } = useAutoSave({
    data: autoSaveData,
    onSave: handleAutoSave,
    enabled: enabled && !!doc,
  });

  // Check if project was changed
  const projectChanged = projectId !== originalProjectId;

  // Manual save (for project changes)
  const handleSave = useCallback(async () => {
    if (!doc) return;

    try {
      if (projectChanged) {
        await moveDocToProject.mutateAsync({
          docId: doc.id,
          workspaceId: doc.workspaceId,
          fromProjectId: originalProjectId,
          toProjectId: projectId,
        });
        setOriginalProjectId(projectId);
      }

      await triggerSave();
      toast.success("Doc saved");
      onClose?.();
    } catch {
      toast.error("Failed to save doc");
    }
  }, [doc, projectChanged, moveDocToProject, originalProjectId, projectId, triggerSave, onClose]);

  // Delete handler
  const handleDeleteConfirm = useCallback(async () => {
    if (!doc) return;

    try {
      await deleteDoc.mutateAsync(doc);
      toast.success("Doc deleted");
      setShowDeleteConfirm(false);
      onDeleted?.();
    } catch {
      toast.error("Failed to delete doc");
    }
  }, [doc, deleteDoc, onDeleted]);

  // Close handler - save pending changes
  const handleClose = useCallback(async () => {
    if (isDirty) {
      await triggerSave();
    }
    onClose?.();
  }, [isDirty, triggerSave, onClose]);

  return {
    // State
    title,
    setTitle,
    content,
    setContent,
    projectId,
    setProjectId,
    isEditorReady,
    showDeleteConfirm,
    setShowDeleteConfirm,

    // Derived
    projectChanged,
    saveStatus,
    isDirty,
    projects: projects.map((p) => ({ id: p.id, name: p.name })),

    // Handlers
    handleSave,
    handleClose,
    handleDeleteConfirm,
  };
}
