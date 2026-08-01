import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tree, type TreeApi } from "react-arborist";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useQueries } from "@tanstack/react-query";
import type { Asset, Doc, FileTreeNode } from "@desk/core/types";
import {
  contentKeys,
  useWorkspaceDocsShell,
  useFolderAIStates,
} from "@/stores";
import { getDeskService, PROJECT_TREE_PATH_PREFIX } from "@desk/core";
import { getDocsPath } from "@desk/core";
import { isTauri } from "@desk/core";
import { sortNodes, type DocSortBy } from "../tree-item-utils";
import {
  canDropInto,
  insertSectionHeaders,
  isDraggable,
  nodesToArborist,
  type ArboristNode,
} from "./arborist-adapter";
import {
  DocsTreeHandlersProvider,
  DocsTreeRow,
} from "./docs-tree-row";
import {
  buildDocMoveTargets,
  collectFolderTreePaths,
  collectProjects,
  composeWorkspaceTree,
  filterTreeByAuthor,
  filterTreeByQuery,
  findSelectedArboristId,
  prefixProjectPaths,
  type DocAuthorFilter,
} from "./docs-tree-model";
import { useDocsTreeActions } from "./use-docs-tree-actions";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

// ── Public props ──────────────────────────────────────────────────────────────

export type { DocAuthorFilter } from "./docs-tree-model";

export interface DocsTreeProps {
  workspaceId: string;
  /** Active doc id from the tab store — used to highlight the matching tree row. */
  activeDocKey: string | null;
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
  activeDocKey,
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
  const { data: overviewTree = [], isLoading } = useWorkspaceDocsShell(workspaceId);

  // Locally tracked set of expanded project IDs — drives per-project query subscriptions.
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());

  // Subscribe to each expanded project's document tree.
  const expandedProjectIdList = useMemo(
    () => Array.from(expandedProjectIds).sort(),
    [expandedProjectIds],
  );
  const projectQueries = useQueries({
    queries: expandedProjectIdList.map((projectId) => ({
      queryKey: contentKeys.tree("project", workspaceId, projectId),
      queryFn: () => getDeskService().getContentTree("project", workspaceId, projectId),
    })),
  });
  const projectSubtrees = useMemo(() => {
    const map = new Map<string, FileTreeNode[]>();
    expandedProjectIdList.forEach((projectId, idx) => {
      const data = projectQueries[idx]?.data;
      if (data) {
        map.set(projectId, prefixProjectPaths(data, projectId));
      }
    });
    return map;
  }, [expandedProjectIdList, projectQueries]);

  // Compose final tree: overview + spliced-in project subtrees
  const composedTree = useMemo(
    () => composeWorkspaceTree(overviewTree, projectSubtrees),
    [overviewTree, projectSubtrees],
  );

  // Apply sort + filter
  const filteredTree = useMemo(() => {
    const byAuthor = filterTreeByAuthor(composedTree, authorFilter);
    const filtered = filterTreeByQuery(byAuthor, searchQuery);
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
  const projects = useMemo(() => collectProjects(overviewTree), [overviewTree]);

  // Build the "Move To" targets for a doc: workspace docs root, workspace folders,
  // and each project — excluding the doc's current container. Folder/project moves
  // all funnel through the one `moveDoc` primitive via onMoveDocToFolder.
  const getDocMoveTargets = useCallback(
    (parentTreePath: string) => buildDocMoveTargets({
      parentTreePath,
      workspaceFolderPaths,
      projects,
      workspaceLabel: t("menus.docContextMenu.workspaceLevel"),
    }),
    [workspaceFolderPaths, projects, t],
  );

  // Provide a unified handler that routes AI toggling to the right scope (workspace only for now)
  const handleToggleFolderAI = useCallback(
    async (treePath: string, currentlyIncluded: boolean) => {
      // Workspace scope only: project-scope folders don't surface this menu item (see FolderRow).
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
  useEffect(() => {
    if (!isTauri()) {
      setWorkspaceBasePath(undefined);
      return;
    }
    getDocsPath("workspace", workspaceId)
      .then(setWorkspaceBasePath)
      .catch(() => setWorkspaceBasePath(undefined));
  }, [workspaceId]);

  const basePathFor = useCallback(
    (treePath: string): string | undefined => {
      // Only workspace-scope base paths are exposed; project-scope reveal needs per-project lookup.
      if (treePath.startsWith(PROJECT_TREE_PATH_PREFIX)) return undefined;
      if (!workspaceBasePath) return undefined;
      return treePath ? `${workspaceBasePath}/${treePath}` : workspaceBasePath;
    },
    [workspaceBasePath],
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

  const selectedArboristId = useMemo(
    () => findSelectedArboristId(activeDocKey, arboristData),
    [activeDocKey, arboristData],
  );

  // ── Arborist handlers ────────────────────────────────────────────────────────

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

  const {
    handleActivate,
    handleRename,
    handleMove,
    handleDelete,
    handlers,
  } = useDocsTreeActions({
    workspaceId,
    onOpenDoc,
    onOpenAsset,
    onCreateDocIn,
    onCreateFolderIn,
    buildDocMoveTargets: getDocMoveTargets,
    onToggleFolderAI: handleToggleFolderAI,
    folderAIStates: workspaceAIStates,
    basePathFor,
  });

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
        <LoadingSkeleton variant="tree" rows={8} className="px-1 py-2" />
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
