import { createContext, useContext, useCallback, type CSSProperties } from "react";
import type { NodeApi } from "react-arborist";
import {
  ChevronRight,
  FileText,
  Folder,
  FolderKanban,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doc, Asset } from "@desk/core/types";
import { extractDocs } from "@desk/core";
import { PROJECT_TREE_PATH_PREFIX } from "@desk/core";
import { TreeItemMenus, TreeItemDropdown } from "../tree-item-menus";
import {
  buildAssetMenuItems,
  buildDocMenuItems,
  buildFolderMenuItems,
  getFileIcon,
  openWithDefaultApp,
  SparklesOff,
  type MenuItem,
} from "../tree-item-utils";
import { InlineRenameInput } from "../inline-rename-input";
import {
  isAIDocsRoot,
  isProjectStub,
  type ArboristNode,
} from "./arborist-adapter";

// ── Handlers exposed via context (avoids drilling through arborist props) ─────

export interface DocsTreeHandlers {
  onSelectDoc: (doc: Doc) => void;
  onOpenAsset: (asset: Asset) => void;
  onRenameDoc: (doc: Doc, newTitle: string) => Promise<void> | void;
  onDeleteDoc: (doc: Doc) => void;
  onDeleteAsset: (asset: Asset) => void;
  onRenameFolder: (treePath: string, newName: string) => Promise<void> | void;
  onDeleteFolder: (treePath: string) => void;
  onCreateDocIn: (treePath: string) => void;
  onCreateFolderIn: (treePath: string) => void;
  onMoveDocToFolder: (doc: Doc, fromTreePath: string, toTreePath: string) => void;
  /** Build the "Move To" targets (folders + projects) for a doc at the given parent path. */
  buildDocMoveTargets: (parentTreePath: string) => { label: string; isProject?: boolean; toTreePath: string }[];
  onToggleFolderAI: (treePath: string, isCurrentlyIncluded: boolean) => void;
  folderAIStates: Map<string, boolean>;
  basePathFor: (treePath: string) => string | undefined;
}

const TreeHandlersContext = createContext<DocsTreeHandlers | null>(null);

export function DocsTreeHandlersProvider({
  handlers,
  children,
}: {
  handlers: DocsTreeHandlers;
  children: React.ReactNode;
}) {
  return (
    <TreeHandlersContext.Provider value={handlers}>{children}</TreeHandlersContext.Provider>
  );
}

function useTreeHandlers(): DocsTreeHandlers {
  const ctx = useContext(TreeHandlersContext);
  if (!ctx) throw new Error("DocsTreeRow used outside DocsTreeHandlersProvider");
  return ctx;
}

// ── Row renderer ──────────────────────────────────────────────────────────────

interface DocsTreeRowProps {
  node: NodeApi<ArboristNode>;
  style: CSSProperties;
  dragHandle?: (el: HTMLDivElement | null) => void;
}

export function DocsTreeRow({ node, style, dragHandle }: DocsTreeRowProps) {
  const data = node.data;
  if (data.kind === "section-header") return <SectionHeaderRow node={node} style={style} />;
  if (data.kind === "folder") return <FolderRow node={node} style={style} dragHandle={dragHandle} />;
  if (data.kind === "doc") return <DocRow node={node} style={style} dragHandle={dragHandle} />;
  return <AssetRow node={node} style={style} dragHandle={dragHandle} />;
}

// ── Section header row (synthetic, non-interactive) ───────────────────────────

function SectionHeaderRow({
  node,
  style,
}: {
  node: NodeApi<ArboristNode>;
  style: CSSProperties;
}) {
  const data = node.data;
  return (
    <div
      style={style}
      className="flex flex-col justify-end gap-2 h-7 pb-0.5 pointer-events-none select-none"
    >
      {data.sectionShowDivider && <div className="h-px bg-border/60" />}
      <span
        style={{ paddingLeft: 16 }}
        className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/45"
      >
        {data.name}
      </span>
    </div>
  );
}

// ── Folder row ────────────────────────────────────────────────────────────────

function FolderRow({ node, style, dragHandle }: DocsTreeRowProps) {
  const data = node.data;
  const handlers = useTreeHandlers();

  const handleClick = useCallback(() => {
    node.toggle();
  }, [node]);

  const handleCommitRename = useCallback(
    (newName: string) => {
      handlers.onRenameFolder(data.treePath, newName);
      node.reset();
    },
    [handlers, data.treePath, node],
  );

  if (data.kind !== "folder") return null;
  const folder = data.node.type === "folder" ? data.node.folder : null;
  if (!folder) return null;

  const isProject = isProjectStub(data);
  const isAIRoot = isAIDocsRoot(data);
  const isProtected = isAIRoot; // synthetic AI Docs cannot be renamed/deleted/dragged
  const isExcludedFromAI = handlers.folderAIStates.get(data.treePath) === false;
  // Counts: projects expose a precomputed recursive total (lazy children aren't loaded yet);
  // everything else has a fully populated subtree from the overview shell, so count inline.
  const docCount = isProject
    ? folder.docCount ?? 0
    : extractDocs([data.node]).length;
  // Folders living inside a project subtree don't support AI inclusion toggling yet.
  // Suppress the menu item entirely instead of showing a stub that explains itself.
  const isInsideProject = data.treePath.startsWith(PROJECT_TREE_PATH_PREFIX);

  const menuItems: MenuItem[] = buildFolderMenuItems({
    folderPath: data.treePath,
    fullFolderPath: handlers.basePathFor(data.treePath) ?? "",
    isAIIncluded: !isExcludedFromAI,
    hasBasePath: !!handlers.basePathFor(data.treePath),
    onNewDocInFolder: isProject ? undefined : () => handlers.onCreateDocIn(data.treePath),
    onNewSubfolder: isProject ? undefined : () => handlers.onCreateFolderIn(data.treePath),
    onToggleFolderAI: isProject || isInsideProject
      ? undefined
      : (path) => handlers.onToggleFolderAI(path, !isExcludedFromAI),
    onRenameFolder: isProtected || isProject ? undefined : () => node.edit(),
    onDeleteFolder: isProtected || isProject ? undefined : (path) => handlers.onDeleteFolder(path),
  });

  const Icon = isProject ? FolderKanban : Folder;

  return (
    <TreeItemMenus items={menuItems}>
      <div
        ref={dragHandle}
        style={style}
        data-drop-tree-path={data.treePath}
        data-drop-target-kind="folder"
        className={cn(
          "group flex items-center gap-1 px-2 h-7 cursor-pointer rounded-sm",
          "hover:bg-accent/40",
          node.isSelected && "bg-accent",
          node.willReceiveDrop && "bg-primary/10 ring-1 ring-primary/40",
          "data-[desk-drop-target=true]:bg-primary/10 data-[desk-drop-target=true]:ring-1 data-[desk-drop-target=true]:ring-primary/40",
        )}
        onClick={handleClick}
        onDoubleClick={(e) => e.preventDefault()}
      >
        <ChevronRight
          className={cn(
            "size-3 shrink-0 text-muted-foreground/60 transition-transform",
            node.isOpen && "rotate-90",
          )}
        />
        <Icon
          className={cn("size-4 shrink-0", isProject ? "text-primary/70" : "text-muted-foreground")}
        />
        {node.isEditing ? (
          <InlineRenameInput
            currentName={folder.name}
            onCommit={handleCommitRename}
            onCancel={() => node.reset()}
            className="flex-1"
          />
        ) : (
          <>
            <span
              className={cn(
                "text-sm truncate",
                isProject ? "font-medium" : "",
                isAIRoot ? "text-muted-foreground" : "",
              )}
            >
              {folder.name}
            </span>
            <div
              className={cn(
                "ml-auto flex items-center gap-1 shrink-0",
                !isProtected && "group-hover:hidden",
              )}
            >
              {docCount > 0 ? (
                <span className="text-[11px] text-muted-foreground/40 tabular-nums">{docCount}</span>
              ) : null}
              {isExcludedFromAI && !isProject && !isAIRoot && (
                <SparklesOff className="size-3.5 text-muted-foreground/60" />
              )}
              {isAIRoot && <Sparkles className="size-3.5 text-muted-foreground/50" />}
            </div>
          </>
        )}
        {!isProtected && <TreeItemDropdown items={menuItems} />}
      </div>
    </TreeItemMenus>
  );
}

// ── Doc row ───────────────────────────────────────────────────────────────────

function DocRow({ node, style, dragHandle }: DocsTreeRowProps) {
  const data = node.data;
  const handlers = useTreeHandlers();
  const doc = data.kind === "doc" && data.node.type === "doc" ? data.node.doc : null;

  const handleClick = useCallback(() => {
    if (doc) handlers.onSelectDoc(doc);
  }, [handlers, doc]);

  const handleCommitRename = useCallback(
    (newTitle: string) => {
      if (doc) handlers.onRenameDoc(doc, newTitle);
      node.reset();
    },
    [handlers, doc, node],
  );

  if (!doc) return null;

  const menuItems: MenuItem[] = buildDocMenuItems({
    filePath: doc.filePath,
    moveTargets: handlers.buildDocMoveTargets(data.parentTreePath),
    onMoveTo: (toTreePath) => handlers.onMoveDocToFolder(doc, data.parentTreePath, toTreePath),
    onDeleteDoc: () => handlers.onDeleteDoc(doc),
    onRenameDoc: () => node.edit(),
  });

  return (
    <TreeItemMenus items={menuItems}>
      <div
        ref={dragHandle}
        style={style}
        data-drop-tree-path={data.parentTreePath}
        data-drop-target-kind="sibling"
        className={cn(
          "group flex items-center gap-1.5 px-2 h-7 cursor-pointer rounded-sm",
          "hover:bg-accent/40",
          node.isSelected && "bg-accent",
        )}
        onClick={handleClick}
      >
        <span className="size-3 shrink-0" />
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        {node.isEditing ? (
          <InlineRenameInput
            currentName={doc.title}
            onCommit={handleCommitRename}
            onCancel={() => node.reset()}
            className="flex-1"
          />
        ) : (
          <span className="text-sm truncate">{doc.title}</span>
        )}
        <div className="ml-auto" />
        <TreeItemDropdown items={menuItems} />
      </div>
    </TreeItemMenus>
  );
}

// ── Asset row ─────────────────────────────────────────────────────────────────

function AssetRow({ node, style, dragHandle }: DocsTreeRowProps) {
  const data = node.data;
  const handlers = useTreeHandlers();
  const asset = data.kind === "asset" && data.node.type === "asset" ? data.node.asset : null;

  const handleClick = useCallback(() => {
    if (asset) handlers.onOpenAsset(asset);
  }, [handlers, asset]);

  if (!asset) return null;

  const Icon = getFileIcon(asset.extension);

  const menuItems: MenuItem[] = buildAssetMenuItems({
    filePath: asset.filePath,
    onOpenExternal: () => openWithDefaultApp(asset.filePath),
    onDeleteAsset: () => handlers.onDeleteAsset(asset),
  });

  return (
    <TreeItemMenus items={menuItems}>
      <div
        ref={dragHandle}
        style={style}
        data-drop-tree-path={data.parentTreePath}
        data-drop-target-kind="sibling"
        className={cn(
          "group flex items-center gap-1.5 px-2 h-7 cursor-pointer rounded-sm",
          "hover:bg-accent/40",
          node.isSelected && "bg-accent",
        )}
        onClick={handleClick}
      >
        <span className="size-3 shrink-0" />
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-sm truncate">{asset.id}</span>
        <div className="ml-auto" />
        <TreeItemDropdown items={menuItems} />
      </div>
    </TreeItemMenus>
  );
}
