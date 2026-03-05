import { type ReactNode } from "react";
import {
  FileText,
  File,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  FileType,
  Sparkles,
  FolderSearch,
  Copy,
  Trash2,
  ExternalLink,
  Pencil,
  FolderPlus,
  FolderInput,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFileCategory } from "@/lib/desk/file-utils";
import { isTauri } from "@/lib/desk/tauri-fs";
import { toast } from "sonner";

// ── Helpers ─────────────────────────────────────────────────────────

export async function revealInFinder(path: string) {
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

export async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path);
    toast.success("Path copied to clipboard");
  } catch (error) {
    console.error("Failed to copy path:", error);
    toast.error("Could not copy path");
  }
}

export async function openWithDefaultApp(filePath: string) {
  try {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_file_with_default_app", { path: filePath });
    } else {
      toast.error("Cannot open files in browser mode");
    }
  } catch (error) {
    console.error("Failed to open file:", error);
    toast.error("Could not open file");
  }
}

// ── Icons ───────────────────────────────────────────────────────────

export function SparklesOff({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <Sparkles className="size-full" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="w-[130%] h-[2px] bg-current rotate-45 rounded-full" />
      </span>
    </span>
  );
}

export function getFileIcon(extension: string) {
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

// ── Indent Guides ───────────────────────────────────────────────────

export function IndentGuides({ depth }: { depth: number }) {
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

// ── Menu Actions (data-driven to avoid duplication) ─────────────────

export interface MenuAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  submenu?: { icon: ReactNode; label: string; onClick: () => void }[];
}

export type MenuSeparator = "separator";
export type MenuItem = MenuAction | MenuSeparator;

/** Build folder menu items */
export function buildFolderMenuItems(opts: {
  folderPath: string;
  fullFolderPath: string;
  isAIIncluded: boolean;
  hasBasePath: boolean;
  onNewDocInFolder?: (path: string) => void;
  onNewSubfolder?: (path: string) => void;
  onToggleFolderAI?: (path: string, included: boolean) => void;
  onRenameFolder?: (path: string) => void;
  onDeleteFolder?: (path: string) => void;
}): MenuItem[] {
  const items: MenuItem[] = [];

  if (opts.onNewDocInFolder) {
    items.push({
      icon: <FileText className="size-4 mr-2" />,
      label: "New Doc",
      onClick: () => opts.onNewDocInFolder!(opts.folderPath),
    });
  }
  if (opts.onNewSubfolder) {
    items.push({
      icon: <FolderPlus className="size-4 mr-2" />,
      label: "New Subfolder",
      onClick: () => opts.onNewSubfolder!(opts.folderPath),
    });
  }
  if (opts.onNewDocInFolder || opts.onNewSubfolder) {
    items.push("separator");
  }
  if (opts.hasBasePath) {
    items.push(
      { icon: <FolderSearch className="size-4 mr-2" />, label: "Reveal in Finder", onClick: () => revealInFinder(opts.fullFolderPath) },
      { icon: <Copy className="size-4 mr-2" />, label: "Copy Path", onClick: () => copyPath(opts.fullFolderPath) },
      "separator"
    );
  }
  if (opts.onToggleFolderAI) {
    items.push({
      icon: opts.isAIIncluded
        ? <SparklesOff className="size-4 mr-2" />
        : <Sparkles className="size-4 mr-2" />,
      label: opts.isAIIncluded ? "Exclude from AI" : "Include in AI",
      onClick: () => opts.onToggleFolderAI!(opts.folderPath, opts.isAIIncluded),
    });
  }
  if (opts.onRenameFolder) {
    items.push({
      icon: <Pencil className="size-4 mr-2" />,
      label: "Rename",
      onClick: () => opts.onRenameFolder!(opts.folderPath),
    });
  }
  if (opts.onDeleteFolder) {
    items.push({
      icon: <Trash2 className="size-4 mr-2" />,
      label: "Delete",
      onClick: () => opts.onDeleteFolder!(opts.folderPath),
      destructive: true,
    });
  }
  return items;
}

/** Build asset menu items */
export function buildAssetMenuItems(opts: {
  filePath: string;
  onOpenExternal: () => void;
  onDeleteAsset?: () => void;
}): MenuItem[] {
  const items: MenuItem[] = [
    { icon: <ExternalLink className="size-4 mr-2" />, label: "Open in Default App", onClick: opts.onOpenExternal },
    { icon: <FolderSearch className="size-4 mr-2" />, label: "Reveal in Finder", onClick: () => revealInFinder(opts.filePath) },
    { icon: <Copy className="size-4 mr-2" />, label: "Copy Path", onClick: () => copyPath(opts.filePath) },
  ];
  if (opts.onDeleteAsset) {
    items.push("separator", {
      icon: <Trash2 className="size-4 mr-2" />,
      label: "Delete",
      onClick: opts.onDeleteAsset,
      destructive: true,
    });
  }
  return items;
}

/** Build doc menu items */
export function buildDocMenuItems(opts: {
  filePath: string;
  docId: string;
  docFolderPath: string;
  moveToFolders: string[];
  onMoveToFolder?: (toPath: string) => void;
  onDeleteDoc?: () => void;
}): MenuItem[] {
  const items: MenuItem[] = [];

  if (opts.onMoveToFolder && opts.moveToFolders.length > 0) {
    const submenuItems: { icon: ReactNode; label: string; onClick: () => void }[] = [];
    if (opts.docFolderPath) {
      submenuItems.push({
        icon: <Folder className="size-4 mr-2" />,
        label: "Root",
        onClick: () => opts.onMoveToFolder!(""),
      });
    }
    for (const folderPath of opts.moveToFolders) {
      submenuItems.push({
        icon: <Folder className="size-4 mr-2" />,
        label: folderPath,
        onClick: () => opts.onMoveToFolder!(folderPath),
      });
    }
    items.push({
      icon: <FolderInput className="size-4 mr-2" />,
      label: "Move to...",
      onClick: () => {},
      submenu: submenuItems,
    });
  }

  items.push(
    { icon: <FolderSearch className="size-4 mr-2" />, label: "Reveal in Finder", onClick: () => revealInFinder(opts.filePath) },
    { icon: <Copy className="size-4 mr-2" />, label: "Copy Path", onClick: () => copyPath(opts.filePath) },
  );

  if (opts.onDeleteDoc) {
    items.push("separator", {
      icon: <Trash2 className="size-4 mr-2" />,
      label: "Delete",
      onClick: opts.onDeleteDoc,
      destructive: true,
    });
  }
  return items;
}
