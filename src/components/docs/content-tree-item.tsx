
import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { toast } from "sonner";
import type { Doc, FileTreeNode, ContentFolder, Asset } from "@/types";
import { getNodeKey } from "@/lib/desk/content";
import {
  SparklesOff,
  getFileIcon,
  IndentGuides,
  openWithDefaultApp,
  buildFolderMenuItems,
  buildAssetMenuItems,
  buildDocMenuItems,
} from "./tree-item-utils";
import { TreeItemMenus, TreeItemDropdown } from "./tree-item-menus";

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
  onDeleteFolder?: (path: string) => void;
  onNewSubfolder?: (parentPath: string) => void;
  onNewDocInFolder?: (folderPath: string) => void;
  onDeleteDoc?: (doc: Doc) => void;
  onDeleteAsset?: (asset: Asset) => void;
  onToggleFolderAI?: (folderPath: string, currentlyIncluded: boolean) => void;
  folderAIStates?: Map<string, boolean>;
  isParentExcluded?: boolean;
  basePath?: string;
  isDraggable?: boolean;
  dropTargetPath?: string | null;
  allFolderPaths?: string[];
  onMoveDocToFolder?: (docId: string, fromPath: string, toPath: string) => Promise<void>;
}

export function ContentTreeItem(props: ContentTreeItemProps) {
  const { node, depth = 0, isParentExcluded = false } = props;
  const paddingLeft = depth * 16 + 8;

  if (node.type === "folder") {
    return (
      <FolderNode
        folder={node.folder}
        depth={depth}
        paddingLeft={paddingLeft}
        treeProps={props}
        isParentExcluded={isParentExcluded}
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
    />
  );
}

// ── Folder Node ─────────────────────────────────────────────────────

function FolderNode({
  folder,
  depth,
  paddingLeft,
  treeProps,
  isParentExcluded,
}: {
  folder: ContentFolder;
  depth: number;
  paddingLeft: number;
  treeProps: ContentTreeItemProps;
  isParentExcluded: boolean;
}) {
  const {
    selectedFolderPath, expandedFolders,
    onSelectFolder, onToggleFolder, onRenameFolder, onDeleteFolder,
    onNewSubfolder, onNewDocInFolder, onToggleFolderAI,
    folderAIStates, basePath, dropTargetPath,
  } = treeProps;

  const [showMenu, setShowMenu] = useState(false);
  const isExpanded = expandedFolders.has(folder.path);
  const isFolderSelected = selectedFolderPath === folder.path;
  const isAIIncluded = folderAIStates?.get(folder.path) ?? true;
  const isExcludedFromAI = !isAIIncluded || isParentExcluded;
  const fullFolderPath = basePath ? `${basePath}/${folder.path}` : folder.path;

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `folder-${folder.path}`,
    data: { folderPath: folder.path },
  });

  const menuItems = useMemo(() => buildFolderMenuItems({
    folderPath: folder.path,
    fullFolderPath,
    isAIIncluded,
    hasBasePath: !!basePath,
    onNewDocInFolder,
    onNewSubfolder,
    onToggleFolderAI,
    onRenameFolder,
    onDeleteFolder,
  }), [folder.path, fullFolderPath, isAIIncluded, basePath, onNewDocInFolder, onNewSubfolder, onToggleFolderAI, onRenameFolder, onDeleteFolder]);

  return (
    <div className="relative" ref={setDropRef}>
      <IndentGuides depth={depth} />

      <TreeItemMenus items={menuItems}>
        <div className="py-0.5" style={{ paddingLeft }}>
          <div
            className={cn(
              "group inline-flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer",
              "hover:bg-accent/50 transition-colors",
              isFolderSelected && "bg-accent",
              isOver && "ring-2 ring-primary ring-offset-1 bg-primary/10"
            )}
            onClick={() => {
              onSelectFolder?.(folder.path);
              onToggleFolder(folder.path);
            }}
          >
            <span className="shrink-0 text-muted-foreground">
              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {isExpanded ? <FolderOpen className="size-4" /> : <Folder className="size-4" />}
            </span>
            <span className="text-sm font-medium truncate max-w-[200px]">{folder.name}</span>
            {isExcludedFromAI && (
              <span title={isParentExcluded ? "Parent folder excluded from AI" : "Excluded from AI"}>
                <SparklesOff className="size-3 text-muted-foreground shrink-0" />
              </span>
            )}
            <TreeItemDropdown items={menuItems} open={showMenu} onOpenChange={setShowMenu} />
          </div>
        </div>
      </TreeItemMenus>

      {isExpanded && folder.children.length > 0 && (
        <div>
          {folder.children.map((child: FileTreeNode) => (
            <ContentTreeItem
              key={getNodeKey(child)}
              {...treeProps}
              node={child}
              depth={depth + 1}
              isParentExcluded={isExcludedFromAI}
            />
          ))}
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
}: {
  asset: Asset;
  depth: number;
  paddingLeft: number;
  isParentExcluded?: boolean;
  onDeleteAsset?: (asset: Asset) => void;
}) {
  const Icon = getFileIcon(asset.extension);

  const handleOpenExternal = () => openWithDefaultApp(asset.filePath);

  const menuItems = useMemo(() => buildAssetMenuItems({
    filePath: asset.filePath,
    onOpenExternal: handleOpenExternal,
    onDeleteAsset: onDeleteAsset ? () => onDeleteAsset(asset) : undefined,
  }), [asset.filePath, asset, onDeleteAsset]);

  return (
    <div className="relative">
      <IndentGuides depth={depth} />

      <TreeItemMenus items={menuItems}>
        <div className="py-0.5" style={{ paddingLeft: paddingLeft + 20 }}>
          <div
            className={cn(
              "group inline-flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer",
              "hover:bg-accent/50 transition-colors"
            )}
            onClick={handleOpenExternal}
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm truncate max-w-[200px]">{asset.id}</span>
            {isParentExcluded && (
              <span title="Parent folder excluded from AI">
                <SparklesOff className="size-3 text-muted-foreground shrink-0" />
              </span>
            )}
            <TreeItemDropdown items={menuItems} />
          </div>
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
  onMoveDocToFolder?: (docId: string, fromPath: string, toPath: string) => Promise<void>;
}) {
  const isSelected = selectedDocId === doc.id;
  const docFolderPath = doc.path?.includes("/")
    ? doc.path.substring(0, doc.path.lastIndexOf("/"))
    : "";
  const moveToFolders = allFolderPaths?.filter(p => p !== docFolderPath) ?? [];

  const handleMoveToFolder = useCallback(async (toPath: string) => {
    if (!onMoveDocToFolder) return;
    try {
      await onMoveDocToFolder(doc.id, docFolderPath, toPath);
      toast.success(`Moved to ${toPath || "root"}`);
    } catch (error) {
      console.error("Failed to move doc:", error);
      toast.error("Failed to move doc");
    }
  }, [doc.id, docFolderPath, onMoveDocToFolder]);

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
  }), [doc.filePath, doc.id, docFolderPath, moveToFolders, onMoveDocToFolder, handleMoveToFolder, onDeleteDoc, doc]);

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
        <div className="py-0.5" style={{ paddingLeft: paddingLeft + 20 }}>
          <div
            className={cn(
              "group inline-flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer",
              "hover:bg-accent/50 transition-colors",
              isSelected && "bg-accent",
              isDragging && "cursor-grabbing"
            )}
            onClick={() => onSelectDoc?.(doc)}
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm truncate max-w-[200px]">{doc.title}</span>
            {isParentExcluded && (
              <span title="Parent folder excluded from AI">
                <SparklesOff className="size-3 text-muted-foreground shrink-0" />
              </span>
            )}
            <TreeItemDropdown items={menuItems} />
          </div>
        </div>
      </TreeItemMenus>
    </div>
  );
}
