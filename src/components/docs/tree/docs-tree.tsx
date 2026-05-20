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
import { useQueries } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { Asset, Doc, FileTreeNode } from "@/types";
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
import * as contentLib from "@/lib/desk/content";
import {
  PROJECT_TREE_PATH_PREFIX,
  isAITreePath,
  resolveTreePath,
  splitTreePathToKind,
} from "@/lib/desk/tree-path";
import { getDocsPath, getAIDocsPath } from "@/lib/desk/paths";
import { isTauri } from "@/lib/desk/tauri-fs";
import { sortNodes, type DocSortBy } from "../tree-item-utils";
import {
  canDropInto,
  isAllowedNewFolderName,
  isDraggable,
  isAIDocsRoot,
  isProjectStub,
  nodesToArborist,
  type ArboristNode,
} from "./arborist-adapter";
import {
  DocsTreeHandlersProvider,
  DocsTreeRow,
  type DocsTreeHandlers,
} from "./docs-tree-row";

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

export interface DocsTreeProps {
  workspaceId: string;
  /** Active doc id from the tab store — used to highlight the matching tree row. */
  activeDocId: string | null;
  searchQuery: string;
  sortBy: DocSortBy;
  sortDir: "asc" | "desc";
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
  onOpenDoc,
  onOpenAsset,
  onCreateDocIn,
  onCreateFolderIn,
}: DocsTreeProps) {
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
      queryFn: () => contentLib.getMergedContentTree("project", workspaceId, projectId),
    })),
  });
  const projectSubtrees = useMemo(() => {
    const map = new Map<string, FileTreeNode[]>();
    expandedProjectIdList.forEach((projectId, idx) => {
      const data = projectQueries[idx]?.data;
      if (data) {
        map.set(projectId, contentLib.prefixSubtreePaths(data, `${PROJECT_TREE_PATH_PREFIX}${projectId}`));
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
    const filtered = filterTree(composedTree, searchQuery);
    return sortNodes(filtered, sortBy, sortDir);
  }, [composedTree, searchQuery, sortBy, sortDir]);

  // Adapt to arborist
  const arboristData = useMemo(() => nodesToArborist(filteredTree, ""), [filteredTree]);

  // Folder AI states — feed both top-level paths (for the toggle) and project paths
  const folderTreePaths = useMemo(() => collectFolderTreePaths(filteredTree), [filteredTree]);

  // For useFolderAIStates we need to identify scope per folder. Simplest: only enable
  // for workspace-scope folders for now (project-scope toggling needs per-project queries).
  // The hook handles paths under `__ai-docs__` via splitTreePathToKind in the workspace-rel translator.
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

  // Provide a unified handler that routes AI toggling to the right scope (workspace only for now)
  const handleToggleFolderAI = useCallback(
    async (treePath: string, currentlyIncluded: boolean) => {
      // Project-scope folders don't surface this menu item (see FolderRow); keep the
      // guard as a silent defensive no-op in case a future caller forgets.
      if (treePath.startsWith(PROJECT_TREE_PATH_PREFIX)) return;
      await toggleWorkspaceAI(treePath, currentlyIncluded);
      const name = treePath.includes("/") ? treePath.split("/").pop() : treePath;
      toast.success(currentlyIncluded ? `"${name}" excluded from AI` : `"${name}" included in AI`);
    },
    [toggleWorkspaceAI],
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
      getAIDocsPath("workspace", workspaceId, undefined),
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
      const isAI = isAITreePath(treePath);
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
          toast.error(`"${trimmed}" is a reserved folder name.`);
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
          toast.success("Renamed");
        } catch (err) {
          console.error("Failed to rename folder:", err);
          toast.error("Failed to rename folder");
        }
        return;
      }
      if (d.kind === "doc" && d.node.type === "doc") {
        try {
          await updateDoc.mutateAsync({ doc: d.node.doc, updates: { title: trimmed } });
          toast.success("Renamed");
        } catch (err) {
          console.error("Failed to rename doc:", err);
          toast.error("Failed to rename doc");
        }
      }
    },
    [renameFolder, updateDoc, workspaceId],
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
      // Target parent treePath ("" = root of merged tree, which is the workspace root)
      const toTreePath = parentNode?.data.treePath ?? "";

      // Reject drops onto project stubs themselves (covered by canDropInto but defensive)
      if (parentNode && isProjectStub(parentNode.data)) return;

      const targetResolved = resolveTreePath(toTreePath);
      const { kind: toKind, subPath: toSubPath } = splitTreePathToKind(targetResolved.scopeTreePath);

      for (const dragNode of dragNodes) {
        const d = dragNode.data;
        const fromResolved = resolveTreePath(d.parentTreePath);

        // Only allow moves that stay within the same scope (workspace ↔ workspace, project X ↔ project X).
        // Cross-scope drag is intentionally not supported in this iteration.
        if (
          fromResolved.scope !== targetResolved.scope
          || fromResolved.projectId !== targetResolved.projectId
        ) {
          toast.error("Cross-scope moves aren't supported yet — moves must stay inside the same workspace or project.");
          continue;
        }

        const { kind: fromKind, subPath: fromSubPath } = splitTreePathToKind(fromResolved.scopeTreePath);

        if (d.kind === "doc" && d.node.type === "doc") {
          try {
            await moveDoc.mutateAsync({
              scope: targetResolved.scope,
              docId: d.node.doc.id,
              fromPath: fromSubPath,
              toPath: toSubPath,
              workspaceId,
              projectId: targetResolved.projectId,
              fromKind,
              toKind,
            });
          } catch (err) {
            console.error("Failed to move doc:", err);
            toast.error("Failed to move doc");
          }
          continue;
        }

        if (d.kind === "folder" && d.node.type === "folder") {
          if (d.node.folder.isProject) continue; // can't move a project stub
          if (isAIDocsRoot(d)) continue; // can't move the synthetic AI Docs folder
          if (fromKind !== toKind) {
            // Cross-kind folder move: useMoveFolder takes a single kind. The lib needs to handle
            // a full directory move from docs/<src> to ai-docs/<dst> (or vice-versa) — currently it
            // doesn't. Surface a friendly toast until that's implemented.
            toast.error(
              "Moving folders between Docs and AI Docs isn't supported yet — move docs individually.",
            );
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
            toast.error("Failed to move folder");
          }
        }
      }
    },
    [moveDoc, moveFolder, workspaceId],
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
            toast.error("Failed to delete doc");
          }
        } else if (d.kind === "asset" && d.node.type === "asset") {
          try {
            await deleteAsset.mutateAsync(d.node.asset);
          } catch (err) {
            console.error("Failed to delete asset:", err);
            toast.error("Failed to delete file");
          }
        } else if (d.kind === "folder" && d.node.type === "folder") {
          if (d.node.folder.isProject) continue;
          if (isAIDocsRoot(d)) continue;
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
            toast.error("Failed to delete folder");
          }
        }
      }
    },
    [deleteDoc, deleteAsset, deleteFolder, workspaceId],
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
        if (
          fromResolved.scope !== toResolved.scope
          || fromResolved.projectId !== toResolved.projectId
        ) {
          toast.error("Cross-scope moves aren't supported yet — moves must stay inside the same workspace or project.");
          return;
        }
        const { kind: fromKind, subPath: fromSubPath } = splitTreePathToKind(fromResolved.scopeTreePath);
        const { kind: toKind, subPath: toSubPath } = splitTreePathToKind(toResolved.scopeTreePath);
        moveDoc.mutate({
          scope: toResolved.scope,
          docId: doc.id,
          fromPath: fromSubPath,
          toPath: toSubPath,
          workspaceId,
          projectId: toResolved.projectId,
          fromKind,
          toKind,
        });
      },
      onToggleFolderAI: handleToggleFolderAI,
      folderAIStates: workspaceAIStates,
      allFolderTreePaths: folderTreePaths,
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
      folderTreePaths,
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
          Loading…
        </div>
      ) : (
        <DocsTreeHandlersProvider handlers={handlers}>
          {size.width > 0 && size.height > 0 && (
            <Tree<ArboristNode>
              ref={treeRef}
              data={arboristData}
              idAccessor={(n) => n.id}
              childrenAccessor={(n) => n.children ?? null}
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
              disableDrag={(n) => !isDraggable(n as unknown as ArboristNode)}
              disableDrop={(args) => !canDropInto(args.parentNode?.data ?? null, args.dragNodes.map((dn) => dn.data))}
            >
              {DocsTreeRow}
            </Tree>
          )}
        </DocsTreeHandlersProvider>
      )}
    </div>
  );
}
