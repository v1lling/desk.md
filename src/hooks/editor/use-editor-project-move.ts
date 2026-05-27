/**
 * Hook to handle project reassignment for editors (task, doc, meeting).
 * Manages optimistic UI state, save-before-move, and error rollback.
 */
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

interface UseEditorProjectMoveOptions<TArgs> {
  /** The entity being edited (must have id, workspaceId, projectId) */
  entity: { id: string; workspaceId: string; projectId: string } | null | undefined;
  /** Save editor content before moving */
  save: () => Promise<boolean>;
  /** Accept the new file path after move */
  acceptPathChange: (path: string) => void;
  /** The move mutation's mutateAsync function */
  move: (args: TArgs) => Promise<{ filePath?: string } | null>;
  /** Entity label for toast messages (e.g., "task", "doc", "meeting") */
  entityLabel: string;
  /** Build the args object for the move mutation */
  buildMoveArgs: (entityId: string, workspaceId: string, fromProjectId: string, toProjectId: string) => TArgs;
}

export function useEditorProjectMove<TArgs>({
  entity,
  save,
  acceptPathChange,
  move,
  entityLabel,
  buildMoveArgs,
}: UseEditorProjectMoveOptions<TArgs>) {
  const [currentProjectId, setCurrentProjectId] = useState("");
  const [originalProjectId, setOriginalProjectId] = useState("");

  // Initialize from entity
  useEffect(() => {
    if (entity) {
      setCurrentProjectId(entity.projectId);
      setOriginalProjectId(entity.projectId);
    }
  }, [entity?.id, entity?.workspaceId]);

  const handleProjectChange = useCallback(
    async (newProjectId: string) => {
      setCurrentProjectId(newProjectId);
      if (!entity || newProjectId === originalProjectId) return;

      try {
        const saved = await save();
        if (!saved) {
          setCurrentProjectId(originalProjectId);
          toast.error(`Save failed. Can't move ${entityLabel}.`);
          return;
        }

        const result = await move(
          buildMoveArgs(entity.id, entity.workspaceId, originalProjectId, newProjectId)
        );

        if (result?.filePath) {
          acceptPathChange(result.filePath);
        }
        setOriginalProjectId(newProjectId);
      } catch {
        setCurrentProjectId(originalProjectId);
        toast.error(`Failed to move ${entityLabel}`);
      }
    },
    [entity, originalProjectId, move, acceptPathChange, save, entityLabel, buildMoveArgs]
  );

  return { currentProjectId, handleProjectChange };
}
