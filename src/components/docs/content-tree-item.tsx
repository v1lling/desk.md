
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  File,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  FileType,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderPlus,
  ExternalLink,
  Sparkles,
  FolderSearch,
  Copy,
  FolderInput,
} from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { getFileCategory, type FileCategory } from "@/lib/desk/file-utils";
import { isTauri } from "@/lib/desk/tauri-fs";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Doc, FileTreeNode, Asset } from "@/types";
import { getNodeKey } from "@/lib/desk/content";

// Helper to reveal file/folder in system file manager
async function revealInFinder(path: string) {
  try {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("reveal_in_finder", { path });
    } else {
      toast.error("Cannot reveal files in browser mode");
    }
  } catch (error) {
    console.error("Failed to reveal in Finder:", error);
    toast.error("Could not reveal in Finder");
  }
}

// Helper to copy path to clipboard
async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path);
    toast.success("Path copied to clipboard");
  } catch (error) {
    console.error("Failed to copy path:", error);
    toast.error("Could not copy path");
  }
}

// Sparkles icon with a diagonal slash through it (for "AI excluded" state)
function SparklesOff({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <Sparkles className="size-full" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="w-[130%] h-[2px] bg-current rotate-45 rounded-full" />
      </span>
    </span>
  );
}

// Get icon component based on file category
function getFileIcon(extension: string) {
  const category = getFileCategory(extension);
  switch (category) {
    case 'image': return FileImage;
    case 'video': return FileVideo;
    case 'audio': return FileAudio;
    case 'spreadsheet': return FileSpreadsheet;
    case 'archive': return FileArchive;
    case 'code': return FileCode;
    case 'data': return FileCode;
    case 'document': return FileType;
    case 'presentation': return FileType;
    default: return File;
  }
}

interface ContentTreeItemProps {
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
  /** Callback to toggle AI inclusion for a folder */
  onToggleFolderAI?: (folderPath: string, currentlyIncluded: boolean) => void;
  /** Map of folder paths to their AI inclusion state (true = included) */
  folderAIStates?: Map<string, boolean>;
  /** Whether this item inherits AI exclusion from a parent folder */
  isParentExcluded?: boolean;
  /** Base path for docs directory (used for Reveal in Finder) */
  basePath?: string;
  /** Whether docs can be dragged */
  isDraggable?: boolean;
  /** Current drop target folder path (for visual feedback) */
  dropTargetPath?: string | null;
  /** All folder paths for "Move to" menu */
  allFolderPaths?: string[];
  /** Callback when a doc is moved to a folder via context menu */
  onMoveDocToFolder?: (docId: string, fromPath: string, toPath: string) => Promise<void>;
}

// Indent guide component - renders vertical lines for tree hierarchy
function IndentGuides({ depth }: { depth: number }) {
  if (depth === 0) return null;

  return (
    <div className="absolute left-0 top-0 bottom-0 pointer-events-none">
      {Array.from({ length: depth }).map((_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 w-px bg-border/50"
          style={{ left: `${i * 16 + 16}px` }}
        />
      ))}
    </div>
  );
}

export function ContentTreeItem({
  node,
  depth = 0,
  selectedDocId,
  selectedFolderPath,
  expandedFolders,
  onSelectDoc,
  onSelectFolder,
  onToggleFolder,
  onRenameFolder,
  onDeleteFolder,
  onNewSubfolder,
  onNewDocInFolder,
  onDeleteDoc,
  onDeleteAsset,
  onToggleFolderAI,
  folderAIStates,
  isParentExcluded = false,
  basePath,
  isDraggable = false,
  dropTargetPath,
  allFolderPaths,
  onMoveDocToFolder,
}: ContentTreeItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const paddingLeft = depth * 16 + 8;

  if (node.type === "folder") {
    const folder = node.folder;
    const isExpanded = expandedFolders.has(folder.path);
    const isFolderSelected = selectedFolderPath === folder.path;
    // AI inclusion state - default to true (included) if not in map
    const isAIIncluded = folderAIStates?.get(folder.path) ?? true;
    // Check if this folder or a parent is excluded from AI
    const isExcludedFromAI = !isAIIncluded || isParentExcluded;
    // Full path for folder (basePath + folder.path)
    const fullFolderPath = basePath ? `${basePath}/${folder.path}` : folder.path;
    // Is this folder currently the drop target?
    const isDropTarget = dropTargetPath === folder.path;

    const menuContent = (
      <>
        {onNewDocInFolder && (
          <ContextMenuItem onClick={() => onNewDocInFolder(folder.path)}>
            <FileText className="size-4 mr-2" />
            New Doc
          </ContextMenuItem>
        )}
        {onNewSubfolder && (
          <ContextMenuItem onClick={() => onNewSubfolder(folder.path)}>
            <FolderPlus className="size-4 mr-2" />
            New Subfolder
          </ContextMenuItem>
        )}
        {(onNewDocInFolder || onNewSubfolder) && <ContextMenuSeparator />}
        {basePath && (
          <>
            <ContextMenuItem onClick={() => revealInFinder(fullFolderPath)}>
              <FolderSearch className="size-4 mr-2" />
              Reveal in Finder
            </ContextMenuItem>
            <ContextMenuItem onClick={() => copyPath(fullFolderPath)}>
              <Copy className="size-4 mr-2" />
              Copy Path
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {onToggleFolderAI && (
          <ContextMenuItem
            onClick={() => onToggleFolderAI(folder.path, isAIIncluded)}
          >
            {isAIIncluded ? (
              <>
                <SparklesOff className="size-4 mr-2" />
                Exclude from AI
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2" />
                Include in AI
              </>
            )}
          </ContextMenuItem>
        )}
        {onRenameFolder && (
          <ContextMenuItem onClick={() => onRenameFolder(folder.path)}>
            <Pencil className="size-4 mr-2" />
            Rename
          </ContextMenuItem>
        )}
        {onDeleteFolder && (
          <ContextMenuItem
            onClick={() => onDeleteFolder(folder.path)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4 mr-2" />
            Delete
          </ContextMenuItem>
        )}
      </>
    );

    // Droppable hook for folder
    const { setNodeRef: setDropRef, isOver } = useDroppable({
      id: `folder-${folder.path}`,
      data: { folderPath: folder.path },
    });

    return (
      <div className="relative" ref={setDropRef}>
        <IndentGuides depth={depth} />

        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className="py-0.5"
              style={{ paddingLeft }}
            >
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
                  {isExpanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {isExpanded ? (
                    <FolderOpen className="size-4" />
                  ) : (
                    <Folder className="size-4" />
                  )}
                </span>
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {folder.name}
                </span>
                {/* AI exclusion indicator - subtle icon */}
                {isExcludedFromAI && (
                  <span title={isParentExcluded ? "Parent folder excluded from AI" : "Excluded from AI"}>
                    <SparklesOff className="size-3 text-muted-foreground shrink-0" />
                  </span>
                )}
                <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "size-5 opacity-0 group-hover:opacity-100 transition-opacity ml-1",
                        showMenu && "opacity-100"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {onNewDocInFolder && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onNewDocInFolder(folder.path);
                        }}
                      >
                        <FileText className="size-4 mr-2" />
                        New Doc
                      </DropdownMenuItem>
                    )}
                    {onNewSubfolder && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onNewSubfolder(folder.path);
                        }}
                      >
                        <FolderPlus className="size-4 mr-2" />
                        New Subfolder
                      </DropdownMenuItem>
                    )}
                    {(onNewDocInFolder || onNewSubfolder) && <DropdownMenuSeparator />}
                    {basePath && (
                      <>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            revealInFinder(fullFolderPath);
                          }}
                        >
                          <FolderSearch className="size-4 mr-2" />
                          Reveal in Finder
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            copyPath(fullFolderPath);
                          }}
                        >
                          <Copy className="size-4 mr-2" />
                          Copy Path
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {onToggleFolderAI && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFolderAI(folder.path, isAIIncluded);
                        }}
                      >
                        {isAIIncluded ? (
                          <>
                            <SparklesOff className="size-4 mr-2" />
                            Exclude from AI
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-4 mr-2" />
                            Include in AI
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    {onRenameFolder && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onRenameFolder(folder.path);
                        }}
                      >
                        <Pencil className="size-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                    )}
                    {onDeleteFolder && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFolder(folder.path);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {menuContent}
          </ContextMenuContent>
        </ContextMenu>

        {isExpanded && folder.children.length > 0 && (
          <div>
            {folder.children.map((child) => (
              <ContentTreeItem
                key={getNodeKey(child)}
                node={child}
                depth={depth + 1}
                selectedDocId={selectedDocId}
                selectedFolderPath={selectedFolderPath}
                expandedFolders={expandedFolders}
                onSelectDoc={onSelectDoc}
                onSelectFolder={onSelectFolder}
                onToggleFolder={onToggleFolder}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
                onNewSubfolder={onNewSubfolder}
                onNewDocInFolder={onNewDocInFolder}
                onDeleteDoc={onDeleteDoc}
                onDeleteAsset={onDeleteAsset}
                onToggleFolderAI={onToggleFolderAI}
                folderAIStates={folderAIStates}
                isParentExcluded={isExcludedFromAI}
                basePath={basePath}
                isDraggable={isDraggable}
                dropTargetPath={dropTargetPath}
                allFolderPaths={allFolderPaths}
                onMoveDocToFolder={onMoveDocToFolder}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Asset node (non-markdown file)
  if (node.type === "asset") {
    const asset = node.asset;
    const Icon = getFileIcon(asset.extension);

    const handleOpenExternal = async () => {
      try {
        if (isTauri()) {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("open_file_with_default_app", { path: asset.filePath });
        } else {
          // Browser fallback - can't open local files
          toast.error("Cannot open files in browser mode");
        }
      } catch (error) {
        console.error("Failed to open file:", error);
        toast.error("Could not open file");
      }
    };

    return (
      <div className="relative">
        <IndentGuides depth={depth} />

        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className="py-0.5"
              style={{ paddingLeft: paddingLeft + 20 }}
            >
              <div
                className={cn(
                  "group inline-flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer",
                  "hover:bg-accent/50 transition-colors"
                )}
                onClick={handleOpenExternal}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm truncate max-w-[200px]">{asset.id}</span>
                {/* AI exclusion indicator - shown when parent folder is excluded */}
                {isParentExcluded && (
                  <span title="Parent folder excluded from AI">
                    <SparklesOff className="size-3 text-muted-foreground shrink-0" />
                  </span>
                )}
                {onDeleteAsset && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={handleOpenExternal}>
                        <ExternalLink className="size-4 mr-2" />
                        Open in Default App
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          revealInFinder(asset.filePath);
                        }}
                      >
                        <FolderSearch className="size-4 mr-2" />
                        Reveal in Finder
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          copyPath(asset.filePath);
                        }}
                      >
                        <Copy className="size-4 mr-2" />
                        Copy Path
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAsset?.(asset);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={handleOpenExternal}>
              <ExternalLink className="size-4 mr-2" />
              Open in Default App
            </ContextMenuItem>
            <ContextMenuItem onClick={() => revealInFinder(asset.filePath)}>
              <FolderSearch className="size-4 mr-2" />
              Reveal in Finder
            </ContextMenuItem>
            <ContextMenuItem onClick={() => copyPath(asset.filePath)}>
              <Copy className="size-4 mr-2" />
              Copy Path
            </ContextMenuItem>
            {onDeleteAsset && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => onDeleteAsset(asset)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
      </div>
    );
  }

  // Document node
  const doc = node.doc;
  const isSelected = selectedDocId === doc.id;

  // Get current folder path from doc.path
  const docFolderPath = doc.path?.includes("/")
    ? doc.path.substring(0, doc.path.lastIndexOf("/"))
    : "";

  // Handler for "Move to" menu
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

  // Draggable hook for docs
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `doc-${doc.id}`,
    data: { doc },
    disabled: !isDraggable,
  });

  // Build "Move to" folder list (exclude current folder)
  const moveToFolders = allFolderPaths?.filter(p => p !== docFolderPath) ?? [];

  return (
    <div
      className="relative"
      ref={setDragRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <IndentGuides depth={depth} />

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="py-0.5"
            style={{ paddingLeft: paddingLeft + 20 }} // Extra indent for docs (no chevron)
          >
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
              {/* AI exclusion indicator - shown when parent folder is excluded */}
              {isParentExcluded && (
                <span title="Parent folder excluded from AI">
                  <SparklesOff className="size-3 text-muted-foreground shrink-0" />
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {onMoveDocToFolder && moveToFolders.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <FolderInput className="size-4 mr-2" />
                        Move to...
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {docFolderPath && (
                          <DropdownMenuItem onClick={() => handleMoveToFolder("")}>
                            <Folder className="size-4 mr-2" />
                            Root
                          </DropdownMenuItem>
                        )}
                        {moveToFolders.map((folderPath) => (
                          <DropdownMenuItem
                            key={folderPath}
                            onClick={() => handleMoveToFolder(folderPath)}
                          >
                            <Folder className="size-4 mr-2" />
                            {folderPath}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      revealInFinder(doc.filePath);
                    }}
                  >
                    <FolderSearch className="size-4 mr-2" />
                    Reveal in Finder
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      copyPath(doc.filePath);
                    }}
                  >
                    <Copy className="size-4 mr-2" />
                    Copy Path
                  </DropdownMenuItem>
                  {onDeleteDoc && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDoc(doc);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {onMoveDocToFolder && moveToFolders.length > 0 && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <FolderInput className="size-4 mr-2" />
                Move to...
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {docFolderPath && (
                  <ContextMenuItem onClick={() => handleMoveToFolder("")}>
                    <Folder className="size-4 mr-2" />
                    Root
                  </ContextMenuItem>
                )}
                {moveToFolders.map((folderPath) => (
                  <ContextMenuItem
                    key={folderPath}
                    onClick={() => handleMoveToFolder(folderPath)}
                  >
                    <Folder className="size-4 mr-2" />
                    {folderPath}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}
          <ContextMenuItem onClick={() => revealInFinder(doc.filePath)}>
            <FolderSearch className="size-4 mr-2" />
            Reveal in Finder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => copyPath(doc.filePath)}>
            <Copy className="size-4 mr-2" />
            Copy Path
          </ContextMenuItem>
          {onDeleteDoc && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => onDeleteDoc(doc)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4 mr-2" />
                Delete
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
