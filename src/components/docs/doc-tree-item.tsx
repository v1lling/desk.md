"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Doc, DocFolder, DocTreeNode } from "@/types";

interface DocTreeItemProps {
  node: DocTreeNode;
  depth?: number;
  selectedDocId?: string | null;
  expandedFolders: Set<string>;
  onSelectDoc?: (doc: Doc) => void;
  onToggleFolder: (path: string) => void;
  onRenameFolder?: (path: string) => void;
  onDeleteFolder?: (path: string) => void;
  onNewSubfolder?: (parentPath: string) => void;
  onNewDocInFolder?: (folderPath: string) => void;
  onDeleteDoc?: (doc: Doc) => void;
}

export function DocTreeItem({
  node,
  depth = 0,
  selectedDocId,
  expandedFolders,
  onSelectDoc,
  onToggleFolder,
  onRenameFolder,
  onDeleteFolder,
  onNewSubfolder,
  onNewDocInFolder,
  onDeleteDoc,
}: DocTreeItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const paddingLeft = depth * 16 + 8;

  if (node.type === "folder") {
    const folder = node.folder;
    const isExpanded = expandedFolders.has(folder.path);

    return (
      <div>
        <div
          className={cn(
            "group flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer",
            "hover:bg-accent/50 transition-colors"
          )}
          style={{ paddingLeft }}
          onClick={() => onToggleFolder(folder.path)}
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
          <span className="flex-1 text-sm font-medium truncate">
            {folder.name}
          </span>
          <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-6 opacity-0 group-hover:opacity-100 transition-opacity",
                  showMenu && "opacity-100"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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

        {isExpanded && folder.children.length > 0 && (
          <div>
            {folder.children.map((child, index) => (
              <DocTreeItem
                key={
                  child.type === "folder"
                    ? `folder-${child.folder.path}`
                    : `doc-${child.doc.id}`
                }
                node={child}
                depth={depth + 1}
                selectedDocId={selectedDocId}
                expandedFolders={expandedFolders}
                onSelectDoc={onSelectDoc}
                onToggleFolder={onToggleFolder}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
                onNewSubfolder={onNewSubfolder}
                onNewDocInFolder={onNewDocInFolder}
                onDeleteDoc={onDeleteDoc}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Document node
  const doc = node.doc;
  const isSelected = selectedDocId === doc.id;

  return (
    <div
      className={cn(
        "group flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer",
        "hover:bg-accent/50 transition-colors",
        isSelected && "bg-accent"
      )}
      style={{ paddingLeft: paddingLeft + 20 }} // Extra indent for docs
      onClick={() => onSelectDoc?.(doc)}
    >
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-sm truncate">{doc.title}</span>
      {onDeleteDoc && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
  );
}
