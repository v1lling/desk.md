
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  FolderKanban,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { toast } from "sonner";
import type { Doc, DocKind, FileTreeNode, ContentFolder, Asset, ScopeOverride } from "@/types";
import { getNodeKey, extractFolderPaths, extractDocs } from "@/lib/desk/content";
import { getDocsPath } from "@/lib/desk/paths";
import { isTauri } from "@/lib/desk/tauri-fs";
import { useContentTree } from "@/stores";
import {
  SparklesOff,
  getFileIcon,
  IndentGuides,
  openWithDefaultApp,
  revealInFinder,
  buildFolderMenuItems,
  buildAssetMenuItems,
  buildDocMenuItems,
  formatRelativeDate,
  sortNodes,
  type DocSortBy,
} from "./tree-item-utils";
import { TreeItemMenus, TreeItemDropdown } from "./tree-item-menus";
import { InlineRenameInput } from "./inline-rename-input";

export interface ContentTreeItemProps {
  node: FileTreeNode;
  depth?: number;
  selectedDocId?: string | null;
  selectedFolderPath?: string | null;
  expandedFolders: Set<string>;
  onSelectDoc?: (doc: Doc) => void;
  onSelectFolder?: (folderPath: string) => void;
  onToggleFolder: (path: string) => void;
  onRenameFolder?: (path: string) => void;
  onDeleteFolder?: (path: string, scopeOverride?: ScopeOverride) => void;
  onNewSubfolder?: (parentPath: string, scopeOverride?: ScopeOverride) => void;
  onNewDocInFolder?: (folderPath?: string, scopeOverride?: ScopeOverride, kind?: DocKind) => void;
  onDeleteDoc?: (doc: Doc) => void;
  onDeleteAsset?: (asset: Asset) => void;
  onToggleFolderAI?: (folderPath: string, currentlyIncluded: boolean) => void;
  folderAIStates?: Map<string, boolean>;
  isParentExcluded?: boolean;
  basePath?: string;
  isDraggable?: boolean;
  dropTargetPath?: string | null;
  allFolderPaths?: string[];
  onMoveDocToFolder?: (
    docId: string,
    fromPath: string,
    toPath: string,
    fromKind: DocKind,
    toKind: DocKind,
    scopeOverride?: ScopeOverride
  ) => Promise<void>;
  /** Kind of the section this subtree belongs to (drives drop-target kind and context-menu move target kind) */
  sectionKind?: DocKind;
  /** Map of node keys to their flat visible index (for zebra striping) */
  visibleIndices?: Map<string, number>;
  /** ID of item currently being renamed (null = none) */
  renamingItemId?: string | null;
  /** Enter rename mode for an item */
  onStartRename?: (itemId: string) => void;
  /** Commit an inline rename (folder path or doc, plus new name) */
  onCommitRename?: (itemId: string, newName: string, scopeOverride?: ScopeOverride) => void;
  /** Cancel rename mode */
  onCancelRename?: () => void;
  /** ID of the currently keyboard-focused item */
  focusedItemId?: string | null;
  /** Set of selected item IDs for multi-select */
  selectedItems?: Set<string>;
  /** Centralized click handler for multi-select (Cmd+click, Shift+click) */
  onItemClick?: (itemId: string, event: React.MouseEvent) => void;
  /** Workspace ID for lazy-loading project folder content */
  workspaceId?: string;
  /** Current sort field */
  sortBy?: DocSortBy;
  /** Current sort direction */
  sortDir?: "asc" | "desc";
  /** Scope override for project children in workspace overview mode */
  projectScopeOverride?: ScopeOverride;
}

export function ContentTreeItem(props: ContentTreeItemProps) {
  const { node, depth = 0, isParentExcluded = false, visibleIndices } = props;
  const paddingLeft = depth * 16 + 8;
  const nodeKey = getNodeKey(node);
  const rowIndex = visibleIndices?.get(nodeKey) ?? 0;
  const isOddRow = rowIndex % 2 === 1;

  if (node.type === "folder") {
    return (
      <FolderNode
        folder={node.folder}
        depth={depth}
        paddingLeft={paddingLeft}
        treeProps={props}
        isParentExcluded={isParentExcluded}
        isOddRow={isOddRow}
      />
    );
  }

  if (node.type === "asset") {
    return (
      <AssetNode
        asset={node.asset}
        depth={depth}
        paddingLeft={paddingLeft}
        isParentExcluded={isParentExcluded}
        onDeleteAsset={props.onDeleteAsset}
        isOddRow={isOddRow}
      />
    );
  }

  return (
    <DocNode
      doc={node.doc}
      depth={depth}
      paddingLeft={paddingLeft}
      selectedDocId={props.selectedDocId}
      isParentExcluded={isParentExcluded}
      isDraggable={props.isDraggable}
      allFolderPaths={props.allFolderPaths}
      onSelectDoc={props.onSelectDoc}
      onDeleteDoc={props.onDeleteDoc}
      onMoveDocToFolder={props.onMoveDocToFolder}
      sectionKind={props.sectionKind}
      isOddRow={isOddRow}
      renamingItemId={props.renamingItemId}
      onStartRename={props.onStartRename}
      onCommitRename={props.onCommitRename}
      onCancelRename={props.onCancelRename}
      focusedItemId={props.focusedItemId}
      selectedItems={props.selectedItems}
      onItemClick={props.onItemClick}
      projectScopeOverride={props.projectScopeOverride}
    />
  );
}

// ── Project Folder Children (lazy loaded) ───────────────────────────

function ProjectFolderChildren({
  workspaceId,
  projectId,
  treeProps,
  depth,
  isExcludedFromAI,
}: {
  workspaceId: string;
  projectId: string;
  treeProps: ContentTreeItemProps;
  depth: number;
  isExcludedFromAI: boolean;
}) {
  const { data: humanTree = [], isLoading: humanLoading } = useContentTree("project", workspaceId, projectId, "human");
  const { data: aiTree = [], isLoading: aiLoading } = useContentTree("project", workspaceId, projectId, "ai");
  const isLoading = humanLoading || aiLoading;

  // Compute project-specific basePath for Reveal in Finder / Copy Path
  const [projectBasePath, setProjectBasePath] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!isTauri()) {
      setProjectBasePath(undefined);
      return;
    }
    getDocsPath("project", workspaceId, projectId)
      .then(setProjectBasePath)
      .catch(() => setProjectBasePath(undefined));
  }, [workspaceId, projectId]);

  // Extract folder paths for project children (for "Move to" submenu)
  const projectFolderPaths = useMemo(() => extractFolderPaths([...humanTree, ...aiTree]), [humanTree, aiTree]);

  const scopeOverride = useMemo<ScopeOverride>(
    () => ({ scope: "project", workspaceId, projectId }),
    [workspaceId, projectId]
  );

  const sortBy = treeProps.sortBy ?? "name";
  const sortDir = treeProps.sortDir ?? "asc";
  const sortedHumanTree = useMemo(() => sortNodes(humanTree, sortBy, sortDir), [humanTree, sortBy, sortDir]);
  const sortedAITree = useMemo(() => sortNodes(aiTree, sortBy, sortDir), [aiTree, sortBy, sortDir]);
  const humanDocCount = useMemo(() => extractDocs(humanTree).length, [humanTree]);
  const aiDocCount = useMemo(() => extractDocs(aiTree).length, [aiTree]);

  // Section expansion state — use virtual paths for tracking
  const docsSectionPath = `_project/${projectId}/_section/docs`;
  const aiDocsSectionPath = `_project/${projectId}/_section/ai-docs`;
  const { expandedFolders, onToggleFolder } = treeProps;

  // Auto-expand project sections on first render
  // Auto-expand only the "Docs" section on first render (AI Docs collapsed by default)
  const autoExpandedRef = useRef(false);
  useEffect(() => {
    if (!isLoading && !autoExpandedRef.current && (humanTree.length > 0 || aiTree.length > 0)) {
      autoExpandedRef.current = true;
      if (!expandedFolders.has(docsSectionPath)) {
        onToggleFolder(docsSectionPath);
      }
    }
  }, [isLoading, humanTree, aiTree, expandedFolders, onToggleFolder, docsSectionPath]);

  const isDocsExpanded = expandedFolders.has(docsSectionPath);
  const isAIDocsExpanded = expandedFolders.has(aiDocsSectionPath);

  // Drop targets for the section headers themselves (project-section root).
  // Dropping a doc here moves it to the project's docs/ or ai-docs/ root.
  const { setNodeRef: setHumanSectionDropRef } = useDroppable({
    id: `drop-section-${docsSectionPath}`,
    data: { folderPath: "", kind: "human" as DocKind },
  });
  const { setNodeRef: setAISectionDropRef } = useDroppable({
    id: `drop-section-${aiDocsSectionPath}`,
    data: { folderPath: "", kind: "ai" as DocKind },
  });

  // Override treeProps with project-scoped values. `sectionKind` flows down so
  // droppables and context-menu moves know which kind they live under.
  const makeProjectTreeProps = useCallback((kind: DocKind): ContentTreeItemProps => ({
    ...treeProps,
    basePath: projectBasePath,
    allFolderPaths: projectFolderPaths,
    projectScopeOverride: scopeOverride,
    sectionKind: kind,
    // Wrap onNewDocInFolder to always pass kind
    onNewDocInFolder: treeProps.onNewDocInFolder
      ? (folderPath?: string, so?: ScopeOverride) => treeProps.onNewDocInFolder!(folderPath, so ?? scopeOverride, kind)
      : undefined,
  }), [treeProps, projectBasePath, projectFolderPaths, scopeOverride]);

  const humanTreeProps = useMemo(() => makeProjectTreeProps("human"), [makeProjectTreeProps]);
  const aiTreeProps = useMemo(() => makeProjectTreeProps("ai"), [makeProjectTreeProps]);

  const sectionPadding = (depth + 1) * 16 + 8;

  if (isLoading) {
    return (
      <div
        className="flex items-center gap-1.5 h-7 text-muted-foreground"
        style={{ paddingLeft: (depth + 1) * 16 + 28 }}
      >
        <Loader2 className="size-3.5 animate-spin" />
        <span className="text-xs">Loading...</span>
      </div>
    );
  }

  return (
    <>
      {/* Docs section */}
      <div ref={setHumanSectionDropRef}>
        <div
          className="flex items-center gap-1.5 pt-2 pb-1 cursor-pointer group"
          style={{ paddingLeft: sectionPadding }}
          onClick={() => onToggleFolder(docsSectionPath)}
        >
          <ChevronRight className={cn("size-3 text-muted-foreground/50 transition-transform", isDocsExpanded && "rotate-90")} />
          <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/60">
            Docs
          </span>
          {humanDocCount > 0 && (
            <span className="text-[10px] text-muted-foreground/50">{humanDocCount}</span>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="size-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              treeProps.onNewDocInFolder?.(undefined, scopeOverride, "human");
            }}
            title="New Doc"
          >
            <Plus className="size-3" />
          </Button>
        </div>
        {isDocsExpanded && sortedHumanTree.length > 0 && (
          <div>
            {sortedHumanTree.map((child: FileTreeNode) => (
              <ContentTreeItem
                key={getNodeKey(child)}
                {...humanTreeProps}
                node={child}
                depth={depth + 1}
                isParentExcluded={isExcludedFromAI}
              />
            ))}
          </div>
        )}
        {isDocsExpanded && sortedHumanTree.length === 0 && (
          <div
            className="py-1.5 text-xs text-muted-foreground/50"
            style={{ paddingLeft: (depth + 2) * 16 + 8 }}
          >
            No docs yet
          </div>
        )}
      </div>

      {/* AI Docs section */}
      <div ref={setAISectionDropRef}>
        <div
          className="flex items-center gap-1.5 pt-2 pb-1 cursor-pointer group"
          style={{ paddingLeft: sectionPadding }}
          onClick={() => onToggleFolder(aiDocsSectionPath)}
        >
          <ChevronRight className={cn("size-3 text-muted-foreground/50 transition-transform", isAIDocsExpanded && "rotate-90")} />
          <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/60">
            AI Docs
          </span>
          {aiDocCount > 0 && (
            <span className="text-[10px] text-muted-foreground/50">{aiDocCount}</span>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="size-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              treeProps.onNewDocInFolder?.(undefined, scopeOverride, "ai");
            }}
            title="New AI Doc"
          >
            <Plus className="size-3" />
          </Button>
        </div>
        {isAIDocsExpanded && sortedAITree.length > 0 && (
          <div>
            {sortedAITree.map((child: FileTreeNode) => (
              <ContentTreeItem
                key={getNodeKey(child)}
                {...aiTreeProps}
                node={child}
                depth={depth + 1}
                isParentExcluded={isExcludedFromAI}
              />
            ))}
          </div>
        )}
        {isAIDocsExpanded && sortedAITree.length === 0 && (
          <div
            className="py-1.5 text-xs text-muted-foreground/50"
            style={{ paddingLeft: (depth + 2) * 16 + 8 }}
          >
            No AI docs yet
          </div>
        )}
      </div>
    </>
  );
}

// ── Folder Node ─────────────────────────────────────────────────────

function FolderNode({
  folder,
  depth,
  paddingLeft,
  treeProps,
  isParentExcluded,
  isOddRow,
}: {
  folder: ContentFolder;
  depth: number;
  paddingLeft: number;
  treeProps: ContentTreeItemProps;
  isParentExcluded: boolean;
  isOddRow: boolean;
}) {
  const {
    selectedFolderPath, expandedFolders,
    onSelectFolder, onToggleFolder, onRenameFolder, onDeleteFolder,
    onNewSubfolder, onNewDocInFolder, onToggleFolderAI,
    folderAIStates, basePath, dropTargetPath,
    renamingItemId, onStartRename, onCommitRename, onCancelRename,
    focusedItemId, selectedItems, onItemClick,
  } = treeProps;

  const [showMenu, setShowMenu] = useState(false);
  const folderItemId = `folder-${folder.path}`;
  const isProject = folder.isProject ?? false;
  const isRenaming = !isProject && renamingItemId === folderItemId;
  const isFocused = focusedItemId === folderItemId;
  const isExpanded = expandedFolders.has(folder.path);
  const isMultiSelected = selectedItems?.has(folderItemId) ?? false;
  const isFolderSelected = isMultiSelected || selectedFolderPath === folder.path;
  const isAIIncluded = folderAIStates?.get(folder.path) ?? true;
  const isExcludedFromAI = !isAIIncluded || isParentExcluded;
  const fullFolderPath = basePath ? `${basePath}/${folder.path}` : folder.path;

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-folder-${folder.path}`,
    data: { folderPath: folder.path, kind: treeProps.sectionKind },
    disabled: isProject,
  });

  const { attributes: dragAttrs, listeners: dragListeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `drag-folder-${folder.path}`,
    data: { folder, type: "folder", kind: treeProps.sectionKind },
    disabled: isProject || !treeProps.isDraggable,
  });

  // Merge drag and drop refs
  const mergedRef = useCallback((node: HTMLDivElement | null) => {
    setDropRef(node);
    setDragRef(node);
  }, [setDropRef, setDragRef]);

  const handleStartRename = useCallback(() => {
    onStartRename?.(folderItemId);
  }, [onStartRename, folderItemId]);

  const scopeOverride = treeProps.projectScopeOverride;

  const menuItems = useMemo(() => {
    if (isProject) {
      if (!folder.projectId || !treeProps.workspaceId) return [];
      const wsId = treeProps.workspaceId;
      const projId = folder.projectId;
      const projScope: ScopeOverride = { scope: "project", workspaceId: wsId, projectId: projId };
      const items = [];
      if (onNewDocInFolder) {
        items.push({
          icon: <FileText className="size-4" />,
          label: "New Doc",
          onClick: () => onNewDocInFolder(undefined, projScope, "human"),
        });
        items.push({
          icon: <FileText className="size-4" />,
          label: "New AI Doc",
          onClick: () => onNewDocInFolder(undefined, projScope, "ai"),
        });
      }
      items.push({
        icon: <FolderOpen className="size-4" />,
        label: "Reveal in Finder",
        onClick: async () => {
          try {
            const projectDocsPath = await getDocsPath("project", wsId, projId);
            await revealInFinder(projectDocsPath);
          } catch { /* ignore if path can't be resolved */ }
        },
      });
      return items;
    }
    return buildFolderMenuItems({
      folderPath: folder.path,
      fullFolderPath,
      isAIIncluded,
      hasBasePath: !!basePath,
      onNewDocInFolder: onNewDocInFolder
        ? (path: string) => onNewDocInFolder(path, scopeOverride)
        : undefined,
      onNewSubfolder: onNewSubfolder
        ? (path: string) => onNewSubfolder(path, scopeOverride)
        : undefined,
      onToggleFolderAI,
      onRenameFolder: onRenameFolder ? handleStartRename : undefined,
      onDeleteFolder: onDeleteFolder
        ? (path: string) => onDeleteFolder(path, scopeOverride)
        : undefined,
    });
  }, [isProject, folder.path, folder.projectId, fullFolderPath, isAIIncluded, basePath, onNewDocInFolder, onNewSubfolder, onToggleFolderAI, onRenameFolder, handleStartRename, onDeleteFolder, scopeOverride, treeProps.workspaceId]);

  // Strip aria-disabled from drag attributes for project folders (they're not draggable but still clickable)
  const { 'aria-disabled': _ariaDisabled, ...cleanDragAttrs } = dragAttrs;

  return (
    <div
      className="relative"
      ref={mergedRef}
      {...cleanDragAttrs}
      {...dragListeners}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <IndentGuides depth={depth} />

      <TreeItemMenus items={menuItems}>
        <div
          data-tree-item-id={folderItemId}
          className={cn(
            "group flex items-center gap-1.5 h-7 pr-2 cursor-pointer transition-colors",
            isOddRow && "bg-muted/30",
            "hover:bg-accent/60",
            isFolderSelected && "bg-accent",
            isFocused && "ring-1 ring-ring ring-inset",
            isOver && "ring-2 ring-primary ring-inset bg-primary/10"
          )}
          style={{ paddingLeft }}
          onClick={(e) => {
            if (isRenaming) return;
            if (onItemClick && (e.metaKey || e.ctrlKey || e.shiftKey)) {
              onItemClick(folderItemId, e);
              return;
            }
            onSelectFolder?.(folder.path);
            onToggleFolder(folder.path);
          }}
        >
          <span className="shrink-0 text-muted-foreground">
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </span>
          <span className={cn("shrink-0", isProject ? "text-primary/70" : "text-muted-foreground")}>
            {isProject ? (
              <FolderKanban className="size-4" />
            ) : isExpanded ? (
              <FolderOpen className="size-4" />
            ) : (
              <Folder className="size-4" />
            )}
          </span>
          {isRenaming ? (
            <InlineRenameInput
              currentName={folder.name}
              onCommit={(newName) => onCommitRename?.(folderItemId, newName, scopeOverride)}
              onCancel={() => onCancelRename?.()}
            />
          ) : (
            <span className="text-sm font-medium truncate min-w-0">{folder.name}</span>
          )}
          {isProject && !isExpanded && (
            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums shrink-0">
              {folder.docCount ?? 0} {(folder.docCount ?? 0) === 1 ? "doc" : "docs"}
              {(folder.assetCount ?? 0) > 0 && `, ${folder.assetCount} files`}
            </span>
          )}
          {!isProject && !isRenaming && isExcludedFromAI && (
            <span title={isParentExcluded ? "Parent folder excluded from AI" : "Excluded from AI"}>
              <SparklesOff className="size-3 text-muted-foreground shrink-0" />
            </span>
          )}
          {!isRenaming && <TreeItemDropdown items={menuItems} open={showMenu} onOpenChange={setShowMenu} />}
        </div>
      </TreeItemMenus>

      {isExpanded && (
        <div>
          {isProject && folder.projectId && treeProps.workspaceId ? (
            <ProjectFolderChildren
              workspaceId={treeProps.workspaceId}
              projectId={folder.projectId}
              treeProps={treeProps}
              depth={depth}
              isExcludedFromAI={isExcludedFromAI}
            />
          ) : folder.children.length > 0 ? (
            folder.children.map((child: FileTreeNode) => (
              <ContentTreeItem
                key={getNodeKey(child)}
                {...treeProps}
                node={child}
                depth={depth + 1}
                isParentExcluded={isExcludedFromAI}
              />
            ))
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Asset Node ──────────────────────────────────────────────────────

function AssetNode({
  asset,
  depth,
  paddingLeft,
  isParentExcluded,
  onDeleteAsset,
  isOddRow,
}: {
  asset: Asset;
  depth: number;
  paddingLeft: number;
  isParentExcluded?: boolean;
  onDeleteAsset?: (asset: Asset) => void;
  isOddRow: boolean;
}) {
  const Icon = getFileIcon(asset.extension);

  const handleOpenExternal = useCallback(() => openWithDefaultApp(asset.filePath), [asset.filePath]);

  const menuItems = useMemo(() => buildAssetMenuItems({
    filePath: asset.filePath,
    onOpenExternal: handleOpenExternal,
    onDeleteAsset: onDeleteAsset ? () => onDeleteAsset(asset) : undefined,
  }), [asset.filePath, asset, onDeleteAsset, handleOpenExternal]);

  return (
    <div className="relative">
      <IndentGuides depth={depth} />

      <TreeItemMenus items={menuItems}>
        <div
          data-tree-item-id={`asset-${asset.id}`}
          className={cn(
            "group flex items-center gap-1.5 h-7 pr-2 cursor-pointer transition-colors",
            isOddRow && "bg-muted/30",
            "hover:bg-accent/60",
          )}
          style={{ paddingLeft: paddingLeft + 20 }}
          onClick={handleOpenExternal}
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm truncate min-w-0">{asset.id}</span>
          {isParentExcluded && (
            <span title="Parent folder excluded from AI">
              <SparklesOff className="size-3 text-muted-foreground shrink-0" />
            </span>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums shrink-0">
            {formatRelativeDate(asset.fileModified || asset.fileCreated)}
          </span>
          <TreeItemDropdown items={menuItems} />
        </div>
      </TreeItemMenus>
    </div>
  );
}

// ── Document Node ───────────────────────────────────────────────────

function DocNode({
  doc,
  depth,
  paddingLeft,
  selectedDocId,
  isParentExcluded,
  isDraggable: draggable,
  allFolderPaths,
  onSelectDoc,
  onDeleteDoc,
  onMoveDocToFolder,
  isOddRow,
  renamingItemId,
  onStartRename,
  onCommitRename,
  onCancelRename,
  focusedItemId,
  selectedItems,
  onItemClick,
  projectScopeOverride,
  sectionKind,
}: {
  doc: Doc;
  depth: number;
  paddingLeft: number;
  selectedDocId?: string | null;
  isParentExcluded?: boolean;
  isDraggable?: boolean;
  allFolderPaths?: string[];
  onSelectDoc?: (doc: Doc) => void;
  onDeleteDoc?: (doc: Doc) => void;
  onMoveDocToFolder?: (
    docId: string,
    fromPath: string,
    toPath: string,
    fromKind: DocKind,
    toKind: DocKind,
    scopeOverride?: ScopeOverride
  ) => Promise<void>;
  sectionKind?: DocKind;
  isOddRow: boolean;
  renamingItemId?: string | null;
  onStartRename?: (itemId: string) => void;
  onCommitRename?: (itemId: string, newName: string, scopeOverride?: ScopeOverride) => void;
  onCancelRename?: () => void;
  focusedItemId?: string | null;
  selectedItems?: Set<string>;
  onItemClick?: (itemId: string, event: React.MouseEvent) => void;
  projectScopeOverride?: ScopeOverride;
}) {
  const docItemId = `doc-${doc.id}`;
  const isRenaming = renamingItemId === docItemId;
  const isFocused = focusedItemId === docItemId;
  const isMultiSelected = selectedItems?.has(docItemId) ?? false;
  const isSelected = isMultiSelected || selectedDocId === doc.id;
  const docFolderPath = doc.path?.includes("/")
    ? doc.path.substring(0, doc.path.lastIndexOf("/"))
    : "";
  const moveToFolders = allFolderPaths?.filter(p => p !== docFolderPath) ?? [];

  const handleMoveToFolder = useCallback(async (toPath: string) => {
    if (!onMoveDocToFolder) return;
    const fromKind: DocKind = doc.kind ?? "human";
    const toKind: DocKind = sectionKind ?? fromKind;
    try {
      await onMoveDocToFolder(doc.id, docFolderPath, toPath, fromKind, toKind, projectScopeOverride);
      toast.success(`Moved to ${toPath || "root"}`);
    } catch (error) {
      console.error("Failed to move doc:", error);
      toast.error("Failed to move doc");
    }
  }, [doc.id, doc.kind, sectionKind, docFolderPath, onMoveDocToFolder, projectScopeOverride]);

  const handleStartRename = useCallback(() => {
    onStartRename?.(docItemId);
  }, [onStartRename, docItemId]);

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `doc-${doc.id}`,
    data: { doc },
    disabled: !draggable,
  });

  const menuItems = useMemo(() => buildDocMenuItems({
    filePath: doc.filePath,
    docId: doc.id,
    docFolderPath,
    moveToFolders,
    onMoveToFolder: onMoveDocToFolder ? handleMoveToFolder : undefined,
    onDeleteDoc: onDeleteDoc ? () => onDeleteDoc(doc) : undefined,
    onRenameDoc: onCommitRename ? handleStartRename : undefined,
  }), [doc.filePath, doc.id, docFolderPath, moveToFolders, onMoveDocToFolder, handleMoveToFolder, onDeleteDoc, doc, onCommitRename, handleStartRename]);

  return (
    <div
      className="relative"
      ref={setDragRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <IndentGuides depth={depth} />

      <TreeItemMenus items={menuItems}>
        <div
          data-tree-item-id={docItemId}
          className={cn(
            "group flex items-center gap-1.5 h-7 pr-2 cursor-pointer transition-colors",
            isOddRow && "bg-muted/30",
            "hover:bg-accent/60",
            isSelected && "bg-accent",
            isFocused && "ring-1 ring-ring ring-inset",
            isDragging && "cursor-grabbing"
          )}
          style={{ paddingLeft: paddingLeft + 20 }}
          onClick={(e) => {
            if (isRenaming) return;
            if (onItemClick && (e.metaKey || e.ctrlKey || e.shiftKey)) {
              onItemClick(docItemId, e);
              return;
            }
            onSelectDoc?.(doc);
          }}
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          {isRenaming ? (
            <InlineRenameInput
              currentName={doc.title}
              onCommit={(newName) => onCommitRename?.(docItemId, newName, projectScopeOverride)}
              onCancel={() => onCancelRename?.()}
            />
          ) : (
            <span className="text-sm truncate min-w-0">{doc.title}</span>
          )}
          {!isRenaming && isParentExcluded && (
            <span title="Parent folder excluded from AI">
              <SparklesOff className="size-3 text-muted-foreground shrink-0" />
            </span>
          )}
          {!isRenaming && (
            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums shrink-0">
              {formatRelativeDate(doc.fileModified || doc.fileCreated || doc.created)}
            </span>
          )}
          {!isRenaming && <TreeItemDropdown items={menuItems} />}
        </div>
      </TreeItemMenus>
    </div>
  );
}
