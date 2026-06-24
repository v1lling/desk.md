import { type ReactNode } from "react";
import i18next from "i18next";
import { formatLocaleDate } from "@/lib/i18n/format";
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
import { getFileCategory } from "@desk/core";
import { isTauri } from "@desk/core";
import { isRemoteMode } from "@/lib/connection";
import { toast } from "sonner";
import type { FileTreeNode } from "@desk/core/types";

// ── Date Formatting ─────────────────────────────────────────────────

export function formatRelativeDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  // Same year: "Jan 15"
  if (date.getFullYear() === now.getFullYear()) {
    return formatLocaleDate(date, { month: "short", day: "numeric" });
  }

  // Different year: "Jan 2024"
  return formatLocaleDate(date, { month: "short", year: "numeric" });
}

// ── Sorting ─────────────────────────────────────────────────────────

export type DocSortBy = "name" | "created" | "modified";

/**
 * Sort tree nodes recursively. Folders always come first, sorted alphabetically.
 * Docs/assets are sorted by the given criteria.
 */
export function sortNodes(
  nodes: FileTreeNode[],
  sortBy: DocSortBy,
  direction: "asc" | "desc"
): FileTreeNode[] {
  const sorted = [...nodes].sort((a, b) => {
    // Project folders always last
    const aIsProject = a.type === "folder" && a.folder.isProject;
    const bIsProject = b.type === "folder" && b.folder.isProject;
    if (aIsProject && !bIsProject) return 1;
    if (!aIsProject && bIsProject) return -1;
    if (aIsProject && bIsProject) return a.folder.name.localeCompare(b.folder.name);

    // Regular folders first
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;

    // Regular folders always alphabetically
    if (a.type === "folder" && b.type === "folder") {
      return a.folder.name.localeCompare(b.folder.name);
    }

    // Docs and assets
    let cmp = 0;
    if (sortBy === "name") {
      const nameA = a.type === "doc" ? a.doc.title : a.type === "asset" ? a.asset.id : "";
      const nameB = b.type === "doc" ? b.doc.title : b.type === "asset" ? b.asset.id : "";
      cmp = nameA.localeCompare(nameB);
    } else if (sortBy === "created") {
      const dateA = (a.type === "doc" ? a.doc.fileCreated : a.type === "asset" ? a.asset.fileCreated : undefined) || "";
      const dateB = (b.type === "doc" ? b.doc.fileCreated : b.type === "asset" ? b.asset.fileCreated : undefined) || "";
      cmp = dateA.localeCompare(dateB);
    } else if (sortBy === "modified") {
      const dateA = (a.type === "doc" ? a.doc.fileModified : a.type === "asset" ? a.asset.fileModified : undefined) || "";
      const dateB = (b.type === "doc" ? b.doc.fileModified : b.type === "asset" ? b.asset.fileModified : undefined) || "";
      cmp = dateA.localeCompare(dateB);
    }
    return direction === "desc" ? -cmp : cmp;
  });

  // Recursively sort folder children (skip project folders)
  return sorted.map(node => {
    if (node.type === "folder" && !node.folder.isProject) {
      return {
        ...node,
        folder: {
          ...node.folder,
          children: sortNodes(node.folder.children, sortBy, direction),
        },
      };
    }
    return node;
  });
}

// ── Helpers ─────────────────────────────────────────────────────────

export async function revealInFinder(path: string) {
  if (isRemoteMode()) {
    toast.error(i18next.t("errors.connection.notAvailableRemote"));
    return;
  }
  try {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("reveal_in_finder", { path });
    } else {
      toast.error(i18next.t("errors.doc.cannotRevealBrowser"));
    }
  } catch (error) {
    console.error("Failed to reveal in Finder:", error);
    toast.error(i18next.t("errors.doc.revealFailed"));
  }
}

export async function copyPath(path: string) {
  try {
    await navigator.clipboard.writeText(path);
    toast.success(i18next.t("toasts.doc.pathCopied"));
  } catch (error) {
    console.error("Failed to copy path:", error);
    toast.error(i18next.t("errors.doc.copyPathFailed"));
  }
}

export async function openWithDefaultApp(filePath: string) {
  if (isRemoteMode()) {
    toast.error(i18next.t("errors.connection.notAvailableRemote"));
    return;
  }
  try {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_file_with_default_app", { path: filePath });
    } else {
      toast.error(i18next.t("errors.doc.cannotOpenBrowser"));
    }
  } catch (error) {
    console.error("Failed to open file:", error);
    toast.error(i18next.t("errors.doc.openFailed"));
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
      label: i18next.t("menus.folderContextMenu.newDoc"),
      onClick: () => opts.onNewDocInFolder!(opts.folderPath),
    });
  }
  if (opts.onNewSubfolder) {
    items.push({
      icon: <FolderPlus className="size-4 mr-2" />,
      label: i18next.t("menus.folderContextMenu.newSubfolder"),
      onClick: () => opts.onNewSubfolder!(opts.folderPath),
    });
  }
  if (opts.onNewDocInFolder || opts.onNewSubfolder) {
    items.push("separator");
  }
  // Reveal/copy act on a local-disk path; meaningless when the data lives on a server.
  if (opts.hasBasePath && !isRemoteMode()) {
    items.push(
      { icon: <FolderSearch className="size-4 mr-2" />, label: i18next.t("menus.common.revealInFinder"), onClick: () => revealInFinder(opts.fullFolderPath) },
      { icon: <Copy className="size-4 mr-2" />, label: i18next.t("menus.common.copyPath"), onClick: () => copyPath(opts.fullFolderPath) },
      "separator"
    );
  }
  if (opts.onToggleFolderAI) {
    items.push({
      icon: opts.isAIIncluded
        ? <SparklesOff className="size-4 mr-2" />
        : <Sparkles className="size-4 mr-2" />,
      label: opts.isAIIncluded
        ? i18next.t("menus.folderContextMenu.excludeFromAI")
        : i18next.t("menus.folderContextMenu.includeInAI"),
      onClick: () => opts.onToggleFolderAI!(opts.folderPath, opts.isAIIncluded),
    });
  }
  if (opts.onRenameFolder) {
    items.push({
      icon: <Pencil className="size-4 mr-2" />,
      label: i18next.t("common.buttons.rename"),
      onClick: () => opts.onRenameFolder!(opts.folderPath),
    });
  }
  if (opts.onDeleteFolder) {
    items.push({
      icon: <Trash2 className="size-4 mr-2" />,
      label: i18next.t("common.buttons.delete"),
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
  const items: MenuItem[] = [];
  // Open-in-app / reveal / copy-path all target a local-disk file; omit in remote mode.
  if (!isRemoteMode()) {
    items.push(
      { icon: <ExternalLink className="size-4 mr-2" />, label: i18next.t("menus.assetContextMenu.openInDefaultApp"), onClick: opts.onOpenExternal },
      { icon: <FolderSearch className="size-4 mr-2" />, label: i18next.t("menus.common.revealInFinder"), onClick: () => revealInFinder(opts.filePath) },
      { icon: <Copy className="size-4 mr-2" />, label: i18next.t("menus.common.copyPath"), onClick: () => copyPath(opts.filePath) },
    );
  }
  if (opts.onDeleteAsset) {
    // Avoid a leading separator when the local-disk items above were omitted (remote mode).
    if (items.length > 0) {
      items.push("separator");
    }
    items.push({
      icon: <Trash2 className="size-4 mr-2" />,
      label: i18next.t("common.buttons.delete"),
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
  onRenameDoc?: () => void;
}): MenuItem[] {
  const items: MenuItem[] = [];

  if (opts.onRenameDoc) {
    items.push({
      icon: <Pencil className="size-4 mr-2" />,
      label: i18next.t("common.buttons.rename"),
      onClick: opts.onRenameDoc,
    });
  }

  if (opts.onMoveToFolder && opts.moveToFolders.length > 0) {
    const submenuItems: { icon: ReactNode; label: string; onClick: () => void }[] = [];
    if (opts.docFolderPath) {
      submenuItems.push({
        icon: <Folder className="size-4 mr-2" />,
        label: i18next.t("menus.docContextMenu.moveToRoot"),
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
      label: i18next.t("menus.docContextMenu.moveTo"),
      onClick: () => {},
      submenu: submenuItems,
    });
  }

  // Reveal/copy act on a local-disk path; meaningless when the data lives on a server.
  if (!isRemoteMode()) {
    items.push(
      { icon: <FolderSearch className="size-4 mr-2" />, label: i18next.t("menus.common.revealInFinder"), onClick: () => revealInFinder(opts.filePath) },
      { icon: <Copy className="size-4 mr-2" />, label: i18next.t("menus.common.copyPath"), onClick: () => copyPath(opts.filePath) },
    );
  }

  if (opts.onDeleteDoc) {
    items.push("separator", {
      icon: <Trash2 className="size-4 mr-2" />,
      label: i18next.t("common.buttons.delete"),
      onClick: opts.onDeleteDoc,
      destructive: true,
    });
  }
  return items;
}
