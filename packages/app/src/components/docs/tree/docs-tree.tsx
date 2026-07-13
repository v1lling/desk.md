import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tree, type NodeApi, type TreeApi } from "react-arborist";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useQueries } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { Asset, Doc, FileTreeNode } from "@desk/core/types";
import type { DocLocation } from "@desk/core";
import {
  contentKeys,
  useMergedWorkspaceOverviewShell,
  useMoveDoc,
  useMoveFolder,
  useRenameFolder,
  useDeleteFolder,
  useDeleteDoc,
  useDeleteAsset,
  useUpdateDoc,
  useFolderAIStates,
} from "@/stores";
import { prefixSubtreePaths } from "@desk/core";
import { getDeskService } from "@desk/core";
import {
  PROJECT_TREE_PATH_PREFIX,
  isContextTreePath,
  resolveTreePath,
  splitTreePathToKind,
} from "@desk/core";
import { getDocsPath, getContextPath } from "@desk/core";
import { isTauri } from "@desk/core";
import { sortNodes, type DocSortBy } from "../tree-item-utils";
import {
  canDropInto,
  insertSectionHeaders,
  isAllowedNewFolderName,
  isDraggable,
  isContextRoot,
  nodesToArborist,
  type ArboristNode,
} from "./arborist-adapter";
import {
  DocsTreeHandlersProvider,
  DocsTreeRow,
  type DocsTreeHandlers,
} from "./docs-tree-row";

/**
 * Recursively filter docs by who wrote them. Provenance, not lifecycle: an agent-written
 * research doc is still the user's material, they just want to browse their own hand
 * without it in the way. Folders (incl. the Context root and project stubs) always survive
 * so the tree keeps its shape and stays a drop target.
 */
function filterTreeByAuthor(nodes: FileTreeNode[], filter: DocAuthorFilter): FileTreeNode[] {
  if (filter === "all") return nodes;
  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "folder") {
      // Recurse into project folders too — an expanded project has its children loaded, and
      // skipping them would leave AI docs visible under a project while "Mine" is selected.
      // The folder itself is always kept (an unexpanded stub simply has no children yet).
      //
      // `docCount` on a project is a precomputed *unfiltered* recursive total, so under a
      // filter it would state a number that contradicts the visible rows. Drop it rather
      // than show a lie; an unexpanded stub can't be recounted without loading it.
      result.push({
        type: "folder",
        folder: {
          ...node.folder,
          docCount: undefined,
          children: filterTreeByAuthor(node.folder.children, filter),
        },
      });
    } else if (node.type === "doc") {
      const isAI = node.doc.author === "ai";
      if (filter === "generated" ? isAI : !isAI) result.push(node);
    } else {
      result.push(node);
    }
  }
  return result;
}

/** Recursively filter tree by search query (matches doc title/content or folder name). */
function filterTree(nodes: FileTreeNode[], query: string): FileTreeNode[] {
  if (!query.trim()) return nodes;
  const q = query.toLowerCase();
  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "folder") {
      if (node.folder.isProject) {
        if (node.folder.name.toLowerCase().includes(q)) result.push(node);
        continue;
      }
      const filteredChildren = filterTree(node.folder.children, query);
      if (filteredChildren.length > 0 || node.folder.name.toLowerCase().includes(q)) {
        result.push({
          type: "folder",
          folder: { ...node.folder, children: filteredChildren.length ? filteredChildren : node.folder.children },
        });
      }
    } else if (node.type === "doc") {
      if (node.doc.title.toLowerCase().includes(q) || node.doc.content?.toLowerCase().includes(q)) {
        result.push(node);
      }
    } else if (node.type === "asset") {
      if (node.asset.id.toLowerCase().includes(q)) result.push(node);
    }
  }
  return result;
}

/** Walk tree and collect every folder treePath (used for "Move to" menu). */
function collectFolderTreePaths(nodes: FileTreeNode[]): string[] {
  const out: string[] = [];
  function walk(ns: FileTreeNode[]) {
    for (const n of ns) {
      if (n.type === "folder" && !n.folder.isProject) {
        out.push(n.folder.path);
        walk(n.folder.children);
      }
    }
  }
  walk(nodes);
  return out;
}

// ── Public props ──────────────────────────────────────────────────────────────

/** Which docs to show, by who wrote them. */
export type DocAuthorFilter = "all" | "mine" | "generated";

export interface DocsTreeProps {
  workspaceId: string;
  /** Active doc id from the tab store — used to highlight the matching tree row. */
  activeDocId: string | null;
  searchQuery: string;
  sortBy: DocSortBy;
  sortDir: "asc" | "desc";
  authorFilter: DocAuthorFilter;
  /** Triggered when the user clicks/activates a doc. */
  onOpenDoc: (doc: Doc) => void;
  /** Triggered when the user clicks/activates an asset (opens with default app). */
  onOpenAsset: (asset: Asset) => void;
  /** Triggered when the user wants to create a new doc inside the given tree path. */
  onCreateDocIn: (treePath: string) => void;
  /** Triggered when the user wants to create a new folder inside the given tree path. */
  onCreateFolderIn: (treePath: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DocsTree({
  workspaceId,
  activeDocId,
  searchQuery,
  sortBy,
  sortDir,
  authorFilter,
  onOpenDoc,
  onOpenAsset,
  onCreateDocIn,
  onCreateFolderIn,
}: DocsTreeProps) {
  const { t } = useTranslation();
  const { data: overviewTree = [], isLoading } = useMergedWorkspaceOverviewShell(workspaceId);

  // Locally tracked set of expanded project IDs — drives per-project query subscriptions.
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());

  // Mutations
  const moveDoc = useMoveDoc();
  const moveFolder = useMoveFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const deleteDoc = useDeleteDoc();
  const deleteAsset = useDeleteAsset();
  const updateDoc = useUpdateDoc();

  // Subscribe to each expanded project's merged tree. Closing a project unsubscribes its query;
  // mutations that invalidate `mergedTree("project", ws, projId)` trigger a refetch + re-render.
  const expandedProjectIdList = useMemo(
    () => Array.from(expandedProjectIds).sort(),
    [expandedProjectIds],
  );
  const projectQueries = useQueries({
    queries: expandedProjectIdList.map((projectId) => ({
      queryKey: contentKeys.mergedTree("project", workspaceId, projectId),
      queryFn: () => getDeskService().getMergedContentTree("project", workspaceId, projectId),
    })),
  });
  const projectSubtrees = useMemo(() => {
    const map = new Map<string, FileTreeNode[]>();
    expandedProjectIdList.forEach((projectId, idx) => {
      const data = projectQueries[idx]?.data;
      if (data) {
        map.set(projectId, prefixSubtreePaths(data, `${PROJECT_TREE_PATH_PREFIX}${projectId}`));
      }
    });
    return map;
  }, [expandedProjectIdList, projectQueries]);

  // Compose final tree: overview + spliced-in project subtrees
  const composedTree: FileTreeNode[] = useMemo(() => {
    return overviewTree.map((node) => {
      if (node.type === "folder" && node.folder.isProject && node.folder.projectId) {
        const cached = projectSubtrees.get(node.folder.projectId);
        if (cached) {
          return {
            type: "folder" as const,
            folder: {
              ...node.folder,
              children: cached,
            },
          };
        }
      }
      return node;
    });
  }, [overviewTree, projectSubtrees]);

  // Apply sort + filter
  const filteredTree = useMemo(() => {
    const byAuthor = filterTreeByAuthor(composedTree, authorFilter);
    const filtered = filterTree(byAuthor, searchQuery);
    return sortNodes(filtered, sortBy, sortDir);
  }, [composedTree, authorFilter, searchQuery, sortBy, sortDir]);

  // Adapt to arborist, then splice in Workspace/Projects section headers at the boundary.
  const arboristData = useMemo(
    () => insertSectionHeaders(nodesToArborist(filteredTree, "")),
    [filteredTree],
  );

  // Folder AI states — feed both top-level paths (for the toggle) and project paths
  const folderTreePaths = useMemo(() => collectFolderTreePaths(filteredTree), [filteredTree]);

  // For useFolderAIStates we need to identify scope per folder. Simplest: only enable
  // for workspace-scope folders for now (project-scope toggling needs per-project queries).
  // The hook handles paths under `__context__` via splitTreePathToKind in the workspace-rel translator.
  const workspaceFolderPaths = useMemo(
    () => folderTreePaths.filter((p) => !p.startsWith(PROJECT_TREE_PATH_PREFIX)),
    [folderTreePaths],
  );
  const { folderAIStates: workspaceAIStates, toggleFolderAI: toggleWorkspaceAI } = useFolderAIStates(
    workspaceFolderPaths,
    workspaceId,
    "workspace",
    undefined,
  );

  // Projects in this workspace (from the overview's project stubs) — targets for
  // the doc "Move To" context submenu.
  const projects = useMemo(() => {
    const out: { id: string; name: string }[] = [];
    for (const n of overviewTree) {
      if (n.type === "folder" && n.folder.isProject && n.folder.projectId) {
        out.push({ id: n.folder.projectId, name: n.folder.name });
      }
    }
    return out;
  }, [overviewTree]);

  // Build the "Move To" targets for a doc: workspace docs root, workspace folders,
  // and each project — excluding the doc's current container. Folder/project moves
  // all funnel through the one `moveDoc` primitive via onMoveDocToFolder.
  const buildDocMoveTargets = useCallback(
    (parentTreePath: string): { label: string; isProject?: boolean; toTreePath: string }[] => {
      const locKey = (treePath: string) => {
        const r = resolveTreePath(treePath);
        const { kind, subPath } = splitTreePathToKind(r.scopeTreePath);
        return `${r.scope}|${r.projectId ?? ""}|${kind}|${subPath}`;
      };
      const fromKey = locKey(parentTreePath);
      const targets: { label: string; isProject?: boolean; toTreePath: string }[] = [];
      // Workspace docs root + workspace (human) folders
      const wsPaths = ["", ...workspaceFolderPaths.filter((p) => !isContextTreePath(p))];
      for (const tp of wsPaths) {
        if (locKey(tp) === fromKey) continue;
        targets.push({ label: tp === "" ? t("menus.docContextMenu.workspaceLevel") : tp, toTreePath: tp });
      }
      // Each project's docs root
      for (const p of projects) {
        const tp = `${PROJECT_TREE_PATH_PREFIX}${p.id}`;
        if (locKey(tp) === fromKey) continue;
        targets.push({ label: p.name, isProject: true, toTreePath: tp });
      }
      return targets;
    },
    [workspaceFolderPaths, projects, t],
  );

  // Provide a unified handler that routes AI toggling to the right scope (workspace only for now)
  const handleToggleFolderAI = useCallback(
    async (treePath: string, currentlyIncluded: boolean) => {
      // Project-scope folders don't surface this menu item (see FolderRow); keep the
      // guard as a silent defensive no-op in case a future caller forgets.
      if (treePath.startsWith(PROJECT_TREE_PATH_PREFIX)) return;
      await toggleWorkspaceAI(treePath, currentlyIncluded);
      const name = treePath.includes("/") ? treePath.split("/").pop() : treePath;
      toast.success(
        currentlyIncluded
          ? t("toasts.folder.excludedFromAI", { name })
          : t("toasts.folder.includedInAI", { name }),
      );
    },
    [toggleWorkspaceAI, t],
  );

  // Base path for "Reveal in Finder"
  const [workspaceBasePath, setWorkspaceBasePath] = useState<string | undefined>(undefined);
  const [workspaceAIBasePath, setWorkspaceAIBasePath] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!isTauri()) {
      setWorkspaceBasePath(undefined);
      setWorkspaceAIBasePath(undefined);
      return;
    }
    Promise.all([
      getDocsPath("workspace", workspaceId, undefined),
      getContextPath("workspace", workspaceId, undefined),
    ])
      .then(([h, a]) => {
        setWorkspaceBasePath(h);
        setWorkspaceAIBasePath(a);
      })
      .catch(() => {
        setWorkspaceBasePath(undefined);
        setWorkspaceAIBasePath(undefined);
      });
  }, [workspaceId]);

  const basePathFor = useCallback(
    (treePath: string): string | undefined => {
      // Only workspace-scope base paths are exposed; project-scope reveal needs per-project lookup.
      if (treePath.startsWith(PROJECT_TREE_PATH_PREFIX)) return undefined;
      const isAI = isContextTreePath(treePath);
      const base = isAI ? workspaceAIBasePath : workspaceBasePath;
      if (!base) return undefined;
      const { subPath } = splitTreePathToKind(treePath);
      return subPath ? `${base}/${subPath}` : base;
    },
    [workspaceBasePath, workspaceAIBasePath],
  );

  // ── Prune expanded set when projects disappear from the overview ─────────────

  const overviewProjectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of overviewTree) {
      if (node.type === "folder" && node.folder.isProject && node.folder.projectId) {
        ids.add(node.folder.projectId);
      }
    }
    return ids;
  }, [overviewTree]);

  useEffect(() => {
    setExpandedProjectIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (overviewProjectIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [overviewProjectIds]);

  // ── Selection sync (active tab → tree) ───────────────────────────────────────

  const treeRef = useRef<TreeApi<ArboristNode> | null>(null);
  const selectedArboristId = useMemo(() => {
    if (!activeDocId) return undefined;
    // Find the ArboristNode whose underlying doc has this id
    function walk(nodes: ArboristNode[]): string | undefined {
      for (const n of nodes) {
        if (n.kind === "doc" && n.node.type === "doc" && n.node.doc.id === activeDocId) {
          return n.id;
        }
        if (n.children) {
          const found = walk(n.children);
          if (found) return found;
        }
      }
      return undefined;
    }
    return walk(arboristData);
  }, [activeDocId, arboristData]);

  // ── Arborist handlers ────────────────────────────────────────────────────────

  const handleActivate = useCallback(
    (node: NodeApi<ArboristNode>) => {
      const data = node.data;
      if (data.kind === "doc" && data.node.type === "doc") onOpenDoc(data.node.doc);
      else if (data.kind === "asset" && data.node.type === "asset") onOpenAsset(data.node.asset);
    },
    [onOpenDoc, onOpenAsset],
  );

  const handleToggle = useCallback((id: string) => {
    // On expand/collapse of a project stub, sync local expansion set so useQueries
    // subscribes / unsubscribes accordingly.
    const node = treeRef.current?.get(id);
    if (!node) return;
    const d = node.data;
    if (
      d.kind === "folder"
      && d.node.type === "folder"
      && d.node.folder.isProject
      && d.node.folder.projectId
    ) {
      const projectId = d.node.folder.projectId;
      const nowOpen = node.isOpen; // reflects post-toggle state
      setExpandedProjectIds((prev) => {
        if (nowOpen && prev.has(projectId)) return prev;
        if (!nowOpen && !prev.has(projectId)) return prev;
        const next = new Set(prev);
        if (nowOpen) next.add(projectId);
        else next.delete(projectId);
        return next;
      });
    }
  }, []);

  const handleRename = useCallback(
    async ({ id, name, node }: { id: string; name: string; node: NodeApi<ArboristNode> }) => {
      void id;
      const trimmed = name.trim();
      if (!trimmed) return;
      const d = node.data;
      if (d.kind === "folder" && d.node.type === "folder") {
        if (!isAllowedNewFolderName(d.parentTreePath, trimmed)) {
          toast.error(t("errors.folder.reservedName", { name: trimmed }));
          return;
        }
        const resolved = resolveTreePath(d.treePath);
        const { kind, subPath } = splitTreePathToKind(resolved.scopeTreePath);
        try {
          await renameFolder.mutateAsync({
            scope: resolved.scope,
            oldPath: subPath,
            newName: trimmed,
            workspaceId,
            projectId: resolved.projectId,
            kind,
          });
          toast.success(t("toasts.common.renamed"));
        } catch (err) {
          console.error("Failed to rename folder:", err);
          toast.error(t("errors.folder.renameFailed"));
        }
        return;
      }
      if (d.kind === "doc" && d.node.type === "doc") {
        try {
          await updateDoc.mutateAsync({ doc: d.node.doc, updates: { title: trimmed } });
          toast.success(t("toasts.common.renamed"));
        } catch (err) {
          console.error("Failed to rename doc:", err);
          toast.error(t("errors.doc.renameFailed"));
        }
      }
    },
    [renameFolder, updateDoc, workspaceId, t],
  );

  const handleMove = useCallback(
    async ({
      dragNodes,
      parentNode,
    }: {
      dragIds: string[];
      dragNodes: NodeApi<ArboristNode>[];
      parentId: string | null;
      parentNode: NodeApi<ArboristNode> | null;
      index: number;
    }) => {
      // Target parent treePath ("" = root of merged tree, which is the workspace root).
      // Dropping onto a project stub resolves to that project's docs root — a valid
      // doc target (the folder branch below still blocks cross-scope folder moves).
      const toTreePath = parentNode?.data.treePath ?? "";

      const targetResolved = resolveTreePath(toTreePath);
      const { kind: toKind, subPath: toSubPath } = splitTreePathToKind(targetResolved.scopeTreePath);

      for (const dragNode of dragNodes) {
        const d = dragNode.data;
        const fromResolved = resolveTreePath(d.parentTreePath);
        const { kind: fromKind, subPath: fromSubPath } = splitTreePathToKind(fromResolved.scopeTreePath);

        if (d.kind === "doc" && d.node.type === "doc") {
          // Docs move freely across scope / project / folder / kind.
          const from: DocLocation = {
            scope: fromResolved.scope,
            projectId: fromResolved.projectId,
            folderPath: fromSubPath,
            kind: fromKind,
          };
          const to: DocLocation = {
            scope: targetResolved.scope,
            projectId: targetResolved.projectId,
            folderPath: toSubPath,
            kind: toKind,
          };
          try {
            await moveDoc.mutateAsync({ docId: d.node.doc.id, workspaceId, from, to });
          } catch (err) {
            console.error("Failed to move doc:", err);
            toast.error(t("errors.doc.moveFailed"));
          }
          continue;
        }

        if (d.kind === "folder" && d.node.type === "folder") {
          if (d.node.folder.isProject) continue; // can't move a project stub
          if (isContextRoot(d)) continue; // the synthetic Context root is not a real folder
          // Folder subtree moves stay within one scope/project (cross-scope folder
          // reparenting is a separate, larger feature).
          if (
            fromResolved.scope !== targetResolved.scope
            || fromResolved.projectId !== targetResolved.projectId
          ) {
            toast.error(t("errors.doc.crossScopeMove"));
            continue;
          }
          if (fromKind !== toKind) {
            // Cross-kind folder move: useMoveFolder takes a single kind. The lib needs to handle
            // a full directory move from docs/<src> to context/<dst> (or vice-versa) — currently it
            // doesn't. Surface a friendly toast until that's implemented.
            toast.error(t("errors.folder.crossKindMove"));
            continue;
          }
          // The fromSubPath represents the OLD path of the folder being moved (the folder itself,
          // not the parent). The translator gave us parentTreePath. Recompute for the source folder.
          const sourceResolved = resolveTreePath(d.treePath);
          const { subPath: sourceSubPath } = splitTreePathToKind(sourceResolved.scopeTreePath);
          try {
            await moveFolder.mutateAsync({
              scope: targetResolved.scope,
              fromPath: sourceSubPath,
              toParentPath: toSubPath,
              workspaceId,
              projectId: targetResolved.projectId,
              kind: fromKind,
            });
          } catch (err) {
            console.error("Failed to move folder:", err);
            toast.error(t("errors.folder.moveFailed"));
          }
        }
      }
    },
    [moveDoc, moveFolder, workspaceId, t],
  );

  const handleDelete = useCallback(
    async ({ nodes }: { ids: string[]; nodes: NodeApi<ArboristNode>[] }) => {
      for (const node of nodes) {
        const d = node.data;
        if (d.kind === "doc" && d.node.type === "doc") {
          try {
            await deleteDoc.mutateAsync(d.node.doc);
          } catch (err) {
            console.error("Failed to delete doc:", err);
            toast.error(t("errors.doc.deleteFailed"));
          }
        } else if (d.kind === "asset" && d.node.type === "asset") {
          try {
            await deleteAsset.mutateAsync(d.node.asset);
          } catch (err) {
            console.error("Failed to delete asset:", err);
            toast.error(t("errors.doc.deleteFileFailed"));
          }
        } else if (d.kind === "folder" && d.node.type === "folder") {
          if (d.node.folder.isProject) continue;
          if (isContextRoot(d)) continue;
          const resolved = resolveTreePath(d.treePath);
          const { kind, subPath } = splitTreePathToKind(resolved.scopeTreePath);
          try {
            await deleteFolder.mutateAsync({
              scope: resolved.scope,
              folderPath: subPath,
              workspaceId,
              projectId: resolved.projectId,
              kind,
            });
          } catch (err) {
            console.error("Failed to delete folder:", err);
            toast.error(t("errors.folder.deleteFailed"));
          }
        }
      }
    },
    [deleteDoc, deleteAsset, deleteFolder, workspaceId, t],
  );

  // ── Row-level handlers (provided via context) ────────────────────────────────

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
        const { kind, subPath } = splitTreePathToKind(resolved.scopeTreePath);
        await renameFolder.mutateAsync({
          scope: resolved.scope,
          oldPath: subPath,
          newName,
          workspaceId,
          projectId: resolved.projectId,
          kind,
        });
      },
      onDeleteFolder: (treePath) => {
        const resolved = resolveTreePath(treePath);
        const { kind, subPath } = splitTreePathToKind(resolved.scopeTreePath);
        deleteFolder.mutate({
          scope: resolved.scope,
          folderPath: subPath,
          workspaceId,
          projectId: resolved.projectId,
          kind,
        });
      },
      onCreateDocIn,
      onCreateFolderIn,
      onMoveDocToFolder: (doc, fromTreePath, toTreePath) => {
        const fromResolved = resolveTreePath(fromTreePath);
        const toResolved = resolveTreePath(toTreePath);
        const { kind: fromKind, subPath: fromSubPath } = splitTreePathToKind(fromResolved.scopeTreePath);
        const { kind: toKind, subPath: toSubPath } = splitTreePathToKind(toResolved.scopeTreePath);
        moveDoc.mutate({
          docId: doc.id,
          workspaceId,
          from: { scope: fromResolved.scope, projectId: fromResolved.projectId, folderPath: fromSubPath, kind: fromKind },
          to: { scope: toResolved.scope, projectId: toResolved.projectId, folderPath: toSubPath, kind: toKind },
        });
      },
      buildDocMoveTargets,
      onToggleFolderAI: handleToggleFolderAI,
      folderAIStates: workspaceAIStates,
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
      handleToggleFolderAI,
      workspaceAIStates,
      buildDocMoveTargets,
      basePathFor,
      workspaceId,
    ],
  );

  // ── Size measurement (arborist needs explicit width/height) ──────────────────

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  // The measured container is rendered unconditionally so `containerRef` is attached
  // from the first mount — loading is a *content* concern, not a *layout* one. Gating
  // the container on `isLoading` would leave the size-measuring effect with a null ref
  // on a cold load, and it never re-runs (empty deps).
  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
      {isLoading ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <Loader2 className="size-4 animate-spin mr-2" />
          {t("common.buttons.loading")}
        </div>
      ) : (
        <DocsTreeHandlersProvider handlers={handlers}>
          {size.width > 0 && size.height > 0 && (
            <Tree<ArboristNode>
              ref={treeRef}
              data={arboristData}
              idAccessor={(n) => n.id}
              childrenAccessor={(n) => n.children ?? null}
              className="desk-thin-scrollbar"
              width={size.width}
              height={size.height}
              rowHeight={28}
              indent={16}
              searchTerm={searchQuery}
              selection={selectedArboristId}
              openByDefault={false}
              onActivate={handleActivate}
              onToggle={handleToggle}
              onRename={handleRename}
              onMove={handleMove}
              onDelete={handleDelete}
              // We've already filtered nodes ourselves (matching title OR body); tell arborist
              // not to re-filter by name so content-only matches stay visible. The searchTerm
              // prop is still useful — arborist auto-expands matched branches.
              searchMatch={() => true}
              disableDrag={(n) => {
                const data = n as unknown as ArboristNode;
                return data.kind === "section-header" || !isDraggable(data);
              }}
              disableDrop={(args) => {
                const parent = args.parentNode?.data ?? null;
                if (parent?.kind === "section-header") return true;
                return !canDropInto(parent, args.dragNodes.map((dn) => dn.data));
              }}
            >
              {DocsTreeRow}
            </Tree>
          )}
        </DocsTreeHandlersProvider>
      )}
    </div>
  );
}
