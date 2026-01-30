"use client";

import { useState } from "react";
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
} from "lucide-react";
import { getFileCategory, type FileCategory } from "@/lib/desk/file-utils";
import { isTauri } from "@/lib/desk/tauri-fs";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Doc, FileTreeNode, Asset } from "@/types";
import { getNodeKey } from "@/lib/desk/content";

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
}: ContentTreeItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const paddingLeft = depth * 16 + 8;

  if (node.type === "folder") {
    const folder = node.folder;
    const isExpanded = expandedFolders.has(folder.path);
    const isFolderSelected = selectedFolderPath === folder.path;

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
        {(onNewDocInFolder || onNewSubfolder) && (onRenameFolder || onDeleteFolder) && (
          <ContextMenuSeparator />
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

    return (
      <div className="relative">
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
                  isFolderSelected && "bg-accent"
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
                    {(onNewDocInFolder || onNewSubfolder) && (onRenameFolder || onDeleteFolder) && (
                      <DropdownMenuSeparator />
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
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAsset(asset);
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

  return (
    <div className="relative">
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
                isSelected && "bg-accent"
              )}
              onClick={() => onSelectDoc?.(doc)}
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-sm truncate max-w-[200px]">{doc.title}</span>
              {onDeleteDoc && (
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
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {onDeleteDoc && (
            <ContextMenuItem
              onClick={() => onDeleteDoc(doc)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4 mr-2" />
              Delete
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
