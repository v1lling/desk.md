import { useCallback, useMemo } from "react";
import type { NodeApi } from "react-arborist";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Asset, Doc } from "@desk/core/types";
import { resolveTreePath } from "@desk/core";
import {
  useDeleteAsset,
  useDeleteDoc,
  useDeleteFolder,
  useMoveDoc,
  useMoveFolder,
  useRenameFolder,
  useUpdateDoc,
} from "@/stores";
import type { ArboristNode } from "./arborist-adapter";
import type { DocsTreeHandlers } from "./docs-tree-row";
import {
  getActivatedDoc,
  planDocMove,
  planTreeMove,
  type DocMoveTarget,
} from "./docs-tree-model";

interface UseDocsTreeActionsOptions {
  workspaceId: string;
  onOpenDoc: (doc: Doc) => void;
  onOpenAsset: (asset: Asset) => void;
  onCreateDocIn: (treePath: string) => void;
  onCreateFolderIn: (treePath: string) => void;
  buildDocMoveTargets: (parentTreePath: string) => DocMoveTarget[];
  onToggleFolderAI: (treePath: string, currentlyIncluded: boolean) => void;
  folderAIStates: Map<string, boolean>;
  basePathFor: (treePath: string) => string | undefined;
}

interface ArboristRenameArgs {
  id: string;
  name: string;
  node: NodeApi<ArboristNode>;
}

interface ArboristMoveArgs {
  dragIds: string[];
  dragNodes: NodeApi<ArboristNode>[];
  parentId: string | null;
  parentNode: NodeApi<ArboristNode> | null;
  index: number;
}

interface ArboristDeleteArgs {
  ids: string[];
  nodes: NodeApi<ArboristNode>[];
}

export function useDocsTreeActions({
  workspaceId,
  onOpenDoc,
  onOpenAsset,
  onCreateDocIn,
  onCreateFolderIn,
  buildDocMoveTargets,
  onToggleFolderAI,
  folderAIStates,
  basePathFor,
}: UseDocsTreeActionsOptions) {
  const { t } = useTranslation();
  const moveDoc = useMoveDoc();
  const moveFolder = useMoveFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const deleteDoc = useDeleteDoc();
  const deleteAsset = useDeleteAsset();
  const updateDoc = useUpdateDoc();

  const handleActivate = useCallback(
    (node: NodeApi<ArboristNode>) => {
      const doc = getActivatedDoc(node.data);
      if (doc) {
        onOpenDoc(doc);
      } else if (node.data.kind === "asset" && node.data.node.type === "asset") {
        onOpenAsset(node.data.node.asset);
      }
    },
    [onOpenDoc, onOpenAsset],
  );

  const handleRename = useCallback(
    async ({ name, node }: ArboristRenameArgs) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const data = node.data;
      if (data.kind === "folder" && data.node.type === "folder") {
        const resolved = resolveTreePath(data.treePath);
        try {
          await renameFolder.mutateAsync({
            scope: resolved.scope,
            oldPath: resolved.scopeTreePath,
            newName: trimmed,
            workspaceId,
            projectId: resolved.projectId,
          });
          toast.success(t("toasts.common.renamed"));
        } catch (error) {
          console.error("Failed to rename folder:", error);
          toast.error(t("errors.folder.renameFailed"));
        }
      } else if (data.kind === "doc" && data.node.type === "doc") {
        try {
          await updateDoc.mutateAsync({ doc: data.node.doc, updates: { title: trimmed } });
          toast.success(t("toasts.common.renamed"));
        } catch (error) {
          console.error("Failed to rename doc:", error);
          toast.error(t("errors.doc.renameFailed"));
        }
      }
    },
    [renameFolder, updateDoc, workspaceId, t],
  );

  const handleMove = useCallback(
    async ({ dragNodes, parentNode }: ArboristMoveArgs) => {
      const toTreePath = parentNode?.data.treePath ?? "";
      for (const dragNode of dragNodes) {
        const move = planTreeMove(dragNode.data, toTreePath);
        if (move.kind === "blocked-folder-cross-scope") {
          toast.error(t("errors.doc.crossScopeMove"));
        } else if (move.kind === "doc") {
          try {
            await moveDoc.mutateAsync({
              docId: move.docId,
              workspaceId,
              from: move.from,
              to: move.to,
            });
          } catch (error) {
            console.error("Failed to move doc:", error);
            toast.error(t("errors.doc.moveFailed"));
          }
        } else if (move.kind === "folder") {
          try {
            await moveFolder.mutateAsync({
              scope: move.scope,
              fromPath: move.fromPath,
              toParentPath: move.toParentPath,
              workspaceId,
              projectId: move.projectId,
            });
          } catch (error) {
            console.error("Failed to move folder:", error);
            toast.error(t("errors.folder.moveFailed"));
          }
        }
      }
    },
    [moveDoc, moveFolder, workspaceId, t],
  );

  const handleDelete = useCallback(
    async ({ nodes }: ArboristDeleteArgs) => {
      for (const node of nodes) {
        const data = node.data;
        if (data.kind === "doc" && data.node.type === "doc") {
          try {
            await deleteDoc.mutateAsync(data.node.doc);
          } catch (error) {
            console.error("Failed to delete doc:", error);
            toast.error(t("errors.doc.deleteFailed"));
          }
        } else if (data.kind === "asset" && data.node.type === "asset") {
          try {
            await deleteAsset.mutateAsync(data.node.asset);
          } catch (error) {
            console.error("Failed to delete asset:", error);
            toast.error(t("errors.doc.deleteFileFailed"));
          }
        } else if (
          data.kind === "folder"
          && data.node.type === "folder"
          && !data.node.folder.isProject
        ) {
          const resolved = resolveTreePath(data.treePath);
          try {
            await deleteFolder.mutateAsync({
              scope: resolved.scope,
              folderPath: resolved.scopeTreePath,
              workspaceId,
              projectId: resolved.projectId,
            });
          } catch (error) {
            console.error("Failed to delete folder:", error);
            toast.error(t("errors.folder.deleteFailed"));
          }
        }
      }
    },
    [deleteDoc, deleteAsset, deleteFolder, workspaceId, t],
  );

  const handlers: DocsTreeHandlers = useMemo(
    () => ({
      onSelectDoc: onOpenDoc,
      onOpenAsset,
      onRenameDoc: async (doc, newTitle) => {
        await updateDoc.mutateAsync({ doc, updates: { title: newTitle } });
      },
      onDeleteDoc: (doc) => deleteDoc.mutate(doc),
      onDeleteAsset: (asset) => deleteAsset.mutate(asset),
      onRenameFolder: async (treePath, newName) => {
        const resolved = resolveTreePath(treePath);
        await renameFolder.mutateAsync({
          scope: resolved.scope,
          oldPath: resolved.scopeTreePath,
          newName,
          workspaceId,
          projectId: resolved.projectId,
        });
      },
      onDeleteFolder: (treePath) => {
        const resolved = resolveTreePath(treePath);
        deleteFolder.mutate({
          scope: resolved.scope,
          folderPath: resolved.scopeTreePath,
          workspaceId,
          projectId: resolved.projectId,
        });
      },
      onCreateDocIn,
      onCreateFolderIn,
      onMoveDocToFolder: (doc, fromTreePath, toTreePath) => {
        const move = planDocMove(doc.id, fromTreePath, toTreePath);
        moveDoc.mutate({
          docId: move.docId,
          workspaceId,
          from: move.from,
          to: move.to,
        });
      },
      buildDocMoveTargets,
      onToggleFolderAI,
      folderAIStates,
      basePathFor,
    }),
    [
      onOpenDoc,
      onOpenAsset,
      updateDoc,
      deleteDoc,
      deleteAsset,
      renameFolder,
      deleteFolder,
      moveDoc,
      onCreateDocIn,
      onCreateFolderIn,
      onToggleFolderAI,
      folderAIStates,
      buildDocMoveTargets,
      basePathFor,
      workspaceId,
    ],
  );

  return { handleActivate, handleRename, handleMove, handleDelete, handlers };
}
