
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FolderPlus, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ContentTreeItem } from "./content-tree-item";
import { sortNodes, type DocSortBy } from "./tree-item-utils";
import type { Doc, FileTreeNode, Asset } from "@/types";
import { getNodeKey } from "@/lib/desk/content";
import { Folder } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import type { ContentFolder } from "@/types";

/**
 * Recursively filter tree nodes based on search query.
 * If a doc/asset matches, include it. If a folder contains matching items, include it with filtered children.
 */
function filterNodes(nodes: FileTreeNode[], query: string): FileTreeNode[] {
  if (!query.trim()) return nodes;

  const lowerQuery = query.toLowerCase();
  const result: FileTreeNode[] = [];

  for (const node of nodes) {
    if (node.type === "folder") {
      // Project folders (lazy loaded): only match on name, don't recurse into empty children
      if (node.folder.isProject) {
        if (node.folder.name.toLowerCase().includes(lowerQuery)) {
          result.push(node);
        }
        continue;
      }
      // Recursively filter folder children
      const filteredChildren = filterNodes(node.folder.children, query);
      // Include folder if it has matching children OR if folder name matches
      if (filteredChildren.length > 0 || node.folder.name.toLowerCase().includes(lowerQuery)) {
        result.push({
          type: "folder",
          folder: {
            ...node.folder,
            children: filteredChildren.length > 0 ? filteredChildren : node.folder.children,
          },
        });
      }
    } else if (node.type === "doc") {
      // Include doc if title or content matches
      if (
        node.doc.title.toLowerCase().includes(lowerQuery) ||
        node.doc.content?.toLowerCase().includes(lowerQuery)
      ) {
        result.push(node);
      }
    } else if (node.type === "asset") {
      // Include asset if filename matches
      if (node.asset.id.toLowerCase().includes(lowerQuery)) {
        result.push(node);
      }
    }
  }

  return result;
}

/**
 * Extract all docs from a tree (recursive).
 */
function extractDocsFromNodes(nodes: FileTreeNode[]): Doc[] {
  const docs: Doc[] = [];
  for (const node of nodes) {
    if (node.type === "doc") {
      docs.push(node.doc);
    } else if (node.type === "folder") {
      docs.push(...extractDocsFromNodes(node.folder.children));
    }
  }
  return docs;
}

/**
 * Compute a flat index map for visible tree nodes (respects folder expansion).
 * Used for zebra striping, keyboard navigation, and range selection.
 */
function computeVisibleIndices(
  nodes: FileTreeNode[],
  expandedFolders: Set<string>
): Map<string, number> {
  const map = new Map<string, number>();
  let index = 0;
  function walk(nodes: FileTreeNode[]) {
    for (const node of nodes) {
      map.set(getNodeKey(node), index++);
      if (node.type === "folder" && expandedFolders.has(node.folder.path)) {
        walk(node.folder.children);
      }
    }
  }
  walk(nodes);
  return map;
}

/**
 * Compute a flat ordered list of visible nodes (respects folder expansion).
 * Used for keyboard navigation and range selection.
 */
function computeVisibleList(
  nodes: FileTreeNode[],
  expandedFolders: Set<string>
): FileTreeNode[] {
  const list: FileTreeNode[] = [];
  function walk(nodes: FileTreeNode[]) {
    for (const node of nodes) {
      list.push(node);
      if (node.type === "folder" && expandedFolders.has(node.folder.path)) {
        walk(node.folder.children);
      }
    }
  }
  walk(nodes);
  return list;
}

/**
 * Get the parent folder path for a node.
 */
function getParentFolderPath(node: FileTreeNode): string | null {
  if (node.type === "folder") {
    const path = node.folder.path;
    const lastSlash = path.lastIndexOf("/");
    return lastSlash >= 0 ? path.substring(0, lastSlash) : null;
  }
  if (node.type === "doc" && node.doc.path?.includes("/")) {
    return node.doc.path.substring(0, node.doc.path.lastIndexOf("/"));
  }
  return null;
}

/**
 * Extract all folder paths from nodes (for auto-expanding during search)
 */
function getAllFolderPaths(nodes: FileTreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === "folder") {
      paths.push(node.folder.path);
      paths.push(...getAllFolderPaths(node.folder.children));
    }
  }
  return paths;
}

interface ContentTreeProps {
  nodes: FileTreeNode[];
  isLoading?: boolean;
  selectedDocId?: string | null;
  selectedFolderPath?: string | null;
  onSelectDoc?: (doc: Doc) => void;
  onSelectFolder?: (folderPath: string) => void;
  onCreateDoc?: (folderPath?: string) => void;
  onDeleteDoc?: (doc: Doc) => void;
  onDeleteAsset?: (asset: Asset) => void;
  onCreateFolder?: (parentPath: string, name: string) => Promise<void>;
  onRenameFolder?: (path: string, newName: string) => Promise<void>;
  onDeleteFolder?: (path: string) => Promise<void>;
  className?: string;
  // Optional controlled expanded state for persistence
  expandedFolders?: string[];
  onExpandedFoldersChange?: (folders: string[]) => void;
  /** Callback to toggle AI inclusion for a folder */
  onToggleFolderAI?: (folderPath: string, currentlyIncluded: boolean) => void;
  /** Map of folder paths to their AI inclusion state (true = included) */
  folderAIStates?: Map<string, boolean>;
  /** Base path for docs directory (used for Reveal in Finder) */
  basePath?: string;
  /** Callback when a doc is moved to a folder */
  onMoveDoc?: (docId: string, fromPath: string, toPath: string) => Promise<void>;
  /** All folder paths for "Move to" menu */
  allFolderPaths?: string[];
  /** Callback when a doc is renamed */
  onRenameDoc?: (doc: Doc, newTitle: string) => Promise<void>;
  /** Callback when a folder is moved to another folder */
  onMoveFolder?: (fromPath: string, toParentPath: string) => Promise<void>;
  /** Workspace ID (needed for lazy-loading project folder content) */
  workspaceId?: string;
  /** Controlled search query (lifted to parent for header placement) */
  searchQuery?: string;
  /** Callback when search query changes */
  onSearchChange?: (query: string) => void;
  /** Controlled sort field */
  sortBy?: DocSortBy;
  /** Callback when sort field changes */
  onSortByChange?: (sortBy: DocSortBy) => void;
  /** Controlled sort direction */
  sortDir?: "asc" | "desc";
  /** Callback when sort direction changes */
  onSortDirChange?: (sortDir: "asc" | "desc") => void;
}

export function ContentTree({
  nodes,
  isLoading,
  selectedDocId,
  selectedFolderPath,
  onSelectDoc,
  onSelectFolder,
  onCreateDoc,
  onDeleteDoc,
  onDeleteAsset,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  className,
  expandedFolders: controlledExpandedFolders,
  onExpandedFoldersChange,
  onToggleFolderAI,
  folderAIStates,
  basePath,
  onMoveDoc,
  allFolderPaths,
  onRenameDoc,
  onMoveFolder,
  workspaceId,
  searchQuery: controlledSearchQuery,
  onSearchChange,
  sortBy: controlledSortBy,
  onSortByChange,
  sortDir: controlledSortDir,
  onSortDirChange,
}: ContentTreeProps) {
  // Search state — controlled if props provided, otherwise local
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const searchQuery = controlledSearchQuery ?? localSearchQuery;
  const setSearchQuery = onSearchChange ?? setLocalSearchQuery;

  // Sort state — controlled if props provided, otherwise local
  const [localSortBy, setLocalSortBy] = useState<DocSortBy>("name");
  const [localSortDir, setLocalSortDir] = useState<"asc" | "desc">("asc");
  const sortBy = controlledSortBy ?? localSortBy;
  const setSortBy = onSortByChange ?? setLocalSortBy;
  const sortDir = controlledSortDir ?? localSortDir;
  const setSortDir = onSortDirChange ?? setLocalSortDir;

  // Inline rename state
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);

  // Multi-select state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lastClickedItemId, setLastClickedItemId] = useState<string | null>(null);

  // Keyboard navigation state
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  // Drag and drop state
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null);
  const [activeFolder, setActiveFolder] = useState<ContentFolder | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    })
  );

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "folder") {
      setActiveFolder(data.folder as ContentFolder);
    } else if (data?.doc) {
      setActiveDoc(data.doc as Doc);
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setDropTargetPath(null);
      return;
    }

    // Check if over a folder or the root drop zone
    const targetPath = over.data.current?.folderPath as string | undefined;
    setDropTargetPath(targetPath ?? (over.id === "root-drop" ? "" : null));
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDoc(null);
    setActiveFolder(null);
    setDropTargetPath(null);

    if (!over) return;

    const data = active.data.current;

    // Determine target folder path
    const targetPath = over.data.current?.folderPath as string | undefined;
    const toPath = targetPath ?? (over.id === "root-drop" ? "" : null);
    if (toPath === null) return;

    // Handle folder drag
    if (data?.type === "folder" && onMoveFolder) {
      const folder = data.folder as ContentFolder;
      const fromParent = folder.path.includes("/")
        ? folder.path.substring(0, folder.path.lastIndexOf("/"))
        : "";

      // Don't move if same parent or dropping onto self
      if (fromParent === toPath || folder.path === toPath) return;
      // Don't allow moving into own descendants
      if (toPath.startsWith(folder.path + "/")) return;

      try {
        await onMoveFolder(folder.path, toPath);
        toast.success(`Moved to ${toPath || "root"}`);
      } catch (error) {
        console.error("Failed to move folder:", error);
        toast.error("Failed to move folder");
      }
      return;
    }

    // Handle doc drag
    if (data?.doc && onMoveDoc) {
      const doc = data.doc as Doc;
      const fromPath = doc.path?.includes("/")
        ? doc.path.substring(0, doc.path.lastIndexOf("/"))
        : "";

      if (fromPath === toPath) return;

      try {
        await onMoveDoc(doc.id, fromPath, toPath);
      } catch (error) {
        console.error("Failed to move doc:", error);
      }
    }
  }, [onMoveDoc, onMoveFolder]);

  const handleDragCancel = useCallback(() => {
    setActiveDoc(null);
    setActiveFolder(null);
    setDropTargetPath(null);
  }, []);

  // Track expanded folders - use controlled state if provided, otherwise local state
  const [localExpandedFolders, setLocalExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  // Store expanded folders before search to restore after
  const preSearchExpandedFoldersRef = useRef<string[] | null>(null);

  // Convert controlled array to Set for consistent usage
  const expandedFolders = controlledExpandedFolders
    ? new Set(controlledExpandedFolders)
    : localExpandedFolders;

  const setExpandedFolders = useCallback((update: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (onExpandedFoldersChange) {
      // Controlled mode - notify parent
      const newSet = typeof update === 'function'
        ? update(new Set(controlledExpandedFolders || []))
        : update;
      onExpandedFoldersChange(Array.from(newSet));
    } else {
      // Uncontrolled mode - use local state
      setLocalExpandedFolders(update);
    }
  }, [controlledExpandedFolders, onExpandedFoldersChange]);

  // Filter and sort nodes
  const filteredNodes = useMemo(
    () => sortNodes(filterNodes(nodes, searchQuery), sortBy, sortDir),
    [nodes, searchQuery, sortBy, sortDir]
  );

  // Compute flat visible indices for zebra striping
  const visibleIndices = useMemo(
    () => computeVisibleIndices(filteredNodes, expandedFolders),
    [filteredNodes, expandedFolders]
  );

  // Compute flat visible list for keyboard navigation
  const visibleList = useMemo(
    () => computeVisibleList(filteredNodes, expandedFolders),
    [filteredNodes, expandedFolders]
  );

  // Scroll focused item into view
  useEffect(() => {
    if (!focusedItemId || !treeContainerRef.current) return;
    const el = treeContainerRef.current.querySelector(`[data-tree-item-id="${CSS.escape(focusedItemId)}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [focusedItemId]);


  // Auto-expand all folders when searching, restore when search clears
  useEffect(() => {
    if (searchQuery.trim()) {
      // Save current expanded state before searching (only once when search starts)
      if (preSearchExpandedFoldersRef.current === null) {
        preSearchExpandedFoldersRef.current = Array.from(expandedFolders);
      }
      // Expand all folders in filtered results
      const allPaths = getAllFolderPaths(filteredNodes);
      setExpandedFolders(new Set(allPaths));
    } else if (preSearchExpandedFoldersRef.current !== null) {
      // Restore previous expanded state when search clears
      setExpandedFolders(new Set(preSearchExpandedFoldersRef.current));
      preSearchExpandedFoldersRef.current = null;
    }
  }, [searchQuery, filteredNodes, expandedFolders, setExpandedFolders]);

  // Modal state for creating folders (rename now uses inline)
  const [folderModal, setFolderModal] = useState<{
    mode: "create";
    parentPath: string;
  } | null>(null);
  const [folderName, setFolderName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ path: string } | null>(null);

  // Wrap onSelectDoc/onSelectFolder to clear multi-selection on plain clicks
  const handleSelectDoc = useCallback((doc: Doc) => {
    setSelectedItems(new Set());
    setLastClickedItemId(`doc-${doc.id}`);
    onSelectDoc?.(doc);
  }, [onSelectDoc]);

  const handleSelectFolder = useCallback((folderPath: string) => {
    setSelectedItems(new Set());
    setLastClickedItemId(`folder-${folderPath}`);
    onSelectFolder?.(folderPath);
  }, [onSelectFolder]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, [setExpandedFolders]);

  const handleNewRootFolder = () => {
    setFolderModal({ mode: "create", parentPath: "" });
    setFolderName("");
  };

  const handleNewSubfolder = (parentPath: string) => {
    setFolderModal({ mode: "create", parentPath });
    setFolderName("");
    // Expand parent folder
    setExpandedFolders((prev) => new Set([...prev, parentPath]));
  };

  // Inline rename: folder rename now triggers inline mode via renamingItemId
  const handleRenameFolder = (path: string) => {
    setRenamingItemId(`folder-${path}`);
  };

  // Handle inline rename commit for both docs and folders
  const handleCommitRename = useCallback(async (itemId: string, newName: string) => {
    setRenamingItemId(null);
    if (itemId.startsWith("folder-")) {
      const folderPath = itemId.slice("folder-".length);
      if (onRenameFolder) {
        try {
          await onRenameFolder(folderPath, newName);
        } catch (error) {
          console.error("Failed to rename folder:", error);
          toast.error("Failed to rename folder");
        }
      }
    } else if (itemId.startsWith("doc-")) {
      const docId = itemId.slice("doc-".length);
      if (onRenameDoc) {
        // Find the doc from the tree
        const allDocs = extractDocsFromNodes(filteredNodes);
        const doc = allDocs.find(d => d.id === docId);
        if (doc) {
          try {
            await onRenameDoc(doc, newName);
          } catch (error) {
            console.error("Failed to rename doc:", error);
            toast.error("Failed to rename doc");
          }
        }
      }
    }
  }, [onRenameFolder, onRenameDoc, filteredNodes]);

  const handleCancelRename = useCallback(() => {
    setRenamingItemId(null);
  }, []);

  // Multi-select click handler (Cmd+click toggle, Shift+click range)
  const handleItemClick = useCallback((itemId: string, event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey) {
      // Cmd/Ctrl+click: toggle item in selection
      setSelectedItems(prev => {
        const next = new Set(prev);
        if (next.has(itemId)) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
        return next;
      });
      setLastClickedItemId(itemId);
      setFocusedItemId(itemId);
    } else if (event.shiftKey && lastClickedItemId) {
      // Shift+click: range select from lastClickedItemId to itemId
      const keys = visibleList.map(n => getNodeKey(n));
      const startIdx = keys.indexOf(lastClickedItemId);
      const endIdx = keys.indexOf(itemId);
      if (startIdx >= 0 && endIdx >= 0) {
        const [from, to] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        setSelectedItems(prev => {
          const next = new Set(prev);
          for (let i = from; i <= to; i++) {
            next.add(keys[i]);
          }
          return next;
        });
      }
      setFocusedItemId(itemId);
    }
  }, [lastClickedItemId, visibleList]);

  const handleDeleteFolder = useCallback((path: string) => {
    setDeleteConfirm({ path });
  }, []);

  // Keyboard navigation handler (must be after toggleFolder & handleDeleteFolder)
  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (renamingItemId) return;
    // Skip keyboard nav when an input is focused (e.g. search in parent)
    if (e.target instanceof HTMLInputElement) return;

    const currentIdx = focusedItemId
      ? visibleList.findIndex(n => getNodeKey(n) === focusedItemId)
      : -1;
    const currentNode = currentIdx >= 0 ? visibleList[currentIdx] : null;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const nextIdx = currentIdx < visibleList.length - 1 ? currentIdx + 1 : 0;
        setFocusedItemId(getNodeKey(visibleList[nextIdx]));
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : visibleList.length - 1;
        setFocusedItemId(getNodeKey(visibleList[prevIdx]));
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        if (currentNode?.type === "folder" && !expandedFolders.has(currentNode.folder.path)) {
          toggleFolder(currentNode.folder.path);
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (currentNode?.type === "folder" && expandedFolders.has(currentNode.folder.path)) {
          toggleFolder(currentNode.folder.path);
        } else if (currentNode) {
          const parentPath = getParentFolderPath(currentNode);
          if (parentPath !== null) {
            setFocusedItemId(`folder-${parentPath}`);
          }
        }
        break;
      }
      case "Enter": {
        e.preventDefault();
        if (currentNode?.type === "folder") {
          handleSelectFolder(currentNode.folder.path);
          toggleFolder(currentNode.folder.path);
        } else if (currentNode?.type === "doc") {
          handleSelectDoc(currentNode.doc);
        }
        break;
      }
      case "F2": {
        e.preventDefault();
        if (focusedItemId) {
          setRenamingItemId(focusedItemId);
        }
        break;
      }
      case "Delete":
      case "Backspace": {
        if (currentNode?.type === "folder" && onDeleteFolder) {
          e.preventDefault();
          handleDeleteFolder(currentNode.folder.path);
        } else if (currentNode?.type === "doc" && onDeleteDoc) {
          e.preventDefault();
          onDeleteDoc(currentNode.doc);
        }
        break;
      }
    }
  }, [focusedItemId, visibleList, expandedFolders, renamingItemId, toggleFolder, handleSelectFolder, handleSelectDoc, onDeleteFolder, onDeleteDoc, handleDeleteFolder]);

  const handleDeleteFolderConfirm = async () => {
    if (deleteConfirm && onDeleteFolder) {
      await onDeleteFolder(deleteConfirm.path);
      setDeleteConfirm(null);
    }
  };

  const handleSubmitFolder = async () => {
    if (!folderModal || !folderName.trim()) return;

    setIsSubmitting(true);
    try {
      if (onCreateFolder) {
        const fullPath = folderModal.parentPath
          ? `${folderModal.parentPath}/${folderName.trim()}`
          : folderName.trim();
        await onCreateFolder(folderModal.parentPath, folderName.trim());
        // Expand the new folder
        setExpandedFolders((prev) => new Set([...prev, fullPath]));
      }
      setFolderModal(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col h-full", className)}
      tabIndex={0}
      onKeyDown={handleTreeKeyDown}
      ref={treeContainerRef}
    >
      {/* Tree container with visual structure */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Toolbar - action buttons */}
        {(onCreateFolder || onCreateDoc) && (
          <div className="shrink-0 flex items-center gap-1 px-4 py-1.5">
            {onCreateFolder && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  if (selectedFolderPath) {
                    handleNewSubfolder(selectedFolderPath);
                  } else {
                    handleNewRootFolder();
                  }
                }}
              >
                <FolderPlus className="size-4" />
                <span className="text-xs">Folder</span>
              </Button>
            )}
            {onCreateDoc && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => onCreateDoc(selectedFolderPath || undefined)}
              >
                <FileText className="size-4" />
                <span className="text-xs">Doc</span>
              </Button>
            )}
          </div>
        )}

        {/* Tree content - scrollable with drag and drop */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <ScrollArea className="flex-1 min-h-0">
            {nodes.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No docs yet"
                  description="Create a doc or folder to get started"
                />
              </div>
            ) : filteredNodes.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No matches"
                  description={`No docs or folders match "${searchQuery}"`}
                />
              </div>
            ) : (
              <div className="py-1 px-2">
                {filteredNodes.map((node, index) => {
                  // Insert a subtle divider before the first project folder
                  const isProjectFolder = node.type === "folder" && node.folder.isProject;
                  const prevNode = index > 0 ? filteredNodes[index - 1] : null;
                  const showProjectDivider = isProjectFolder &&
                    (prevNode === null || !(prevNode.type === "folder" && prevNode.folder.isProject));

                  return (
                    <div key={getNodeKey(node)}>
                      {showProjectDivider && (
                        <div className="flex items-center gap-2 px-2 pt-2.5 pb-1">
                          <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/60">Projects</span>
                          <div className="flex-1 h-px bg-border/50" />
                        </div>
                      )}
                      <ContentTreeItem
                        node={node}
                        selectedDocId={selectedDocId}
                        selectedFolderPath={selectedFolderPath}
                        expandedFolders={expandedFolders}
                        onSelectDoc={handleSelectDoc}
                        onSelectFolder={handleSelectFolder}
                        onToggleFolder={toggleFolder}
                        onRenameFolder={onRenameFolder ? handleRenameFolder : undefined}
                        onDeleteFolder={onDeleteFolder ? handleDeleteFolder : undefined}
                        onNewSubfolder={onCreateFolder ? handleNewSubfolder : undefined}
                        onNewDocInFolder={onCreateDoc}
                        onDeleteDoc={onDeleteDoc}
                        onDeleteAsset={onDeleteAsset}
                        onToggleFolderAI={onToggleFolderAI}
                        folderAIStates={folderAIStates}
                        basePath={basePath}
                        isDraggable={!!(onMoveDoc || onMoveFolder)}
                        dropTargetPath={dropTargetPath}
                        allFolderPaths={allFolderPaths}
                        onMoveDocToFolder={onMoveDoc}
                        workspaceId={workspaceId}
                        sortBy={sortBy}
                        sortDir={sortDir}
                        visibleIndices={visibleIndices}
                        renamingItemId={renamingItemId}
                        onStartRename={setRenamingItemId}
                        onCommitRename={handleCommitRename}
                        onCancelRename={handleCancelRename}
                        focusedItemId={focusedItemId}
                        selectedItems={selectedItems}
                        onItemClick={handleItemClick}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Drag overlay - shows item being dragged */}
          <DragOverlay>
            {activeDoc && (
              <div className="inline-flex items-center gap-1 py-1 px-2 rounded-md bg-accent shadow-lg">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm truncate max-w-[200px]">{activeDoc.title}</span>
              </div>
            )}
            {activeFolder && (
              <div className="inline-flex items-center gap-1 py-1 px-2 rounded-md bg-accent shadow-lg">
                <Folder className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium truncate max-w-[200px]">{activeFolder.name}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Folder create/rename modal */}
      <Dialog
        open={!!folderModal}
        onOpenChange={(open) => !open && setFolderModal(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription className="sr-only">
              Create a new folder
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && folderName.trim()) {
                  handleSubmitFolder();
                }
              }}
              autoFocus
            />
            {folderModal?.parentPath && (
              <p className="text-sm text-muted-foreground mt-2">
                Creating in: {folderModal.parentPath}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFolder}
              disabled={!folderName.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder delete confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Delete Folder"
        description={`Delete "${deleteConfirm?.path.split("/").pop()}" and all its contents? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteFolderConfirm}
      />
    </div>
  );
}
