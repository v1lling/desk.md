import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown01,
  ArrowDownAZ,
  ArrowUp01,
  ArrowUpAZ,
  ChevronsUpDown,
  FolderOpen,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Asset, Doc } from "@/types";
import {
  useCreateFolder,
  useImportFiles,
  useMergedWorkspaceOverviewShell,
  useOpenTab,
  useTabStore,
} from "@/stores";
import { extractDocs, extractAssets } from "@/lib/desk/content";
import { isMarkdownFile } from "@/lib/desk/file-utils";
import { isTauri } from "@/lib/desk/tauri-fs";
import { getDocsPath } from "@/lib/desk/paths";
import {
  displayTreePath,
  resolveTreePath,
  splitTreePathToKind,
} from "@/lib/desk/tree-path";
import { isAllowedNewFolderName } from "./tree/arborist-adapter";
import { revealInFinder, type DocSortBy } from "./tree-item-utils";
import { ContentDropZone } from "./content-drop-zone";
import { NewDocModal } from "./new-doc-modal";
import { DocsTree } from "./tree/docs-tree";

interface DocsTreePaneProps {
  workspaceId: string;
}

export function DocsTreePane({ workspaceId }: DocsTreePaneProps) {
  const { data: overviewTree = [] } = useMergedWorkspaceOverviewShell(workspaceId);

  const { openDoc } = useOpenTab();
  // Select the active doc id directly so re-renders only fire when this primitive changes,
  // not whenever any tab in the array gets a new reference.
  const activeDocId = useTabStore((s) => {
    const t = s.tabs.find((t) => t.id === s.activeTabId);
    return t?.type === "doc" ? t.entityId ?? null : null;
  });

  const createFolder = useCreateFolder();
  const importFiles = useImportFiles();

  // ── Header state ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<DocSortBy>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── New doc modal state ─────────────────────────────────────────────────────
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [newDocFolderPath, setNewDocFolderPath] = useState<string>("");
  const [newDocScope, setNewDocScope] = useState<"workspace" | "project" | "personal">("workspace");
  const [newDocProjectId, setNewDocProjectId] = useState<string | undefined>(undefined);

  // ── New folder modal state ──────────────────────────────────────────────────
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderParent, setNewFolderParent] = useState<string>("");
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // ── File count ──────────────────────────────────────────────────────────────
  const totalFiles = useMemo(() => {
    let count = 0;
    for (const node of overviewTree) {
      if (node.type === "doc" || node.type === "asset") count++;
      else if (node.type === "folder" && node.folder.isProject) {
        count += (node.folder.docCount ?? 0) + (node.folder.assetCount ?? 0);
      } else if (node.type === "folder") {
        count += extractDocs([node]).length + extractAssets([node]).length;
      }
    }
    return count;
  }, [overviewTree]);

  // ── Workspace base path for "Reveal in Finder" ──────────────────────────────
  const [workspaceBasePath, setWorkspaceBasePath] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!isTauri()) {
      setWorkspaceBasePath(undefined);
      return;
    }
    getDocsPath("workspace", workspaceId).then(setWorkspaceBasePath).catch(() => setWorkspaceBasePath(undefined));
  }, [workspaceId]);

  // ── Handlers wired into the tree ────────────────────────────────────────────

  const handleOpenDoc = useCallback(
    (doc: Doc) => {
      openDoc({
        id: doc.id,
        title: doc.title,
        workspaceId: doc.workspaceId,
        projectId: doc.projectId,
      });
    },
    [openDoc],
  );

  const handleOpenAsset = useCallback((asset: Asset) => {
    // Open with default app — same behavior as the old tree.
    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke("open_file_with_default_app", { path: asset.filePath }))
      .catch(() => toast.error("Could not open file"));
  }, []);

  const openNewDocForTreePath = useCallback(
    (treePath: string) => {
      const resolved = resolveTreePath(treePath);
      setNewDocFolderPath(treePath);
      setNewDocScope(resolved.scope);
      setNewDocProjectId(resolved.projectId);
      setNewDocOpen(true);
    },
    [],
  );

  const openNewFolderForTreePath = useCallback((treePath: string) => {
    setNewFolderParent(treePath);
    setNewFolderName("");
    setNewFolderOpen(true);
  }, []);

  const handleSubmitNewFolder = useCallback(async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    if (!isAllowedNewFolderName(newFolderParent, trimmed)) {
      toast.error(`"${trimmed}" is a reserved folder name.`);
      return;
    }
    const resolved = resolveTreePath(newFolderParent);
    const { kind, subPath } = splitTreePathToKind(resolved.scopeTreePath);
    const fullPath = subPath ? `${subPath}/${trimmed}` : trimmed;
    setCreatingFolder(true);
    try {
      await createFolder.mutateAsync({
        scope: resolved.scope,
        folderPath: fullPath,
        workspaceId,
        projectId: resolved.projectId,
        kind,
      });
      setNewFolderOpen(false);
    } catch (err) {
      console.error("Failed to create folder:", err);
      toast.error("Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  }, [newFolderName, newFolderParent, createFolder, workspaceId]);

  // ── Imports (OS drag-drop + button) ─────────────────────────────────────────

  const handleFilesDropped = useCallback(
    async (files: File[]) => {
      try {
        const fileContents = await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            content: isMarkdownFile(file.name)
              ? await file.text()
              : new Uint8Array(await file.arrayBuffer()),
          })),
        );
        const result = await importFiles.mutateAsync({
          files: fileContents,
          scope: "workspace",
          workspaceId,
          // Default to human docs root; OS imports never target ai-docs implicitly.
          kind: "human",
        });
        const importedDocs = result.docs.length;
        const importedAssets = result.assets.length;
        if (importedDocs > 0 && importedAssets > 0) {
          toast.success(`Imported ${importedDocs} docs and ${importedAssets} files`);
        } else if (importedDocs > 0) toast.success(`Imported ${importedDocs} doc${importedDocs > 1 ? "s" : ""}`);
        else if (importedAssets > 0) toast.success(`Imported ${importedAssets} file${importedAssets > 1 ? "s" : ""}`);
      } catch (err) {
        console.error("Failed to import files:", err);
        toast.error("Failed to import files");
      }
    },
    [importFiles, workspaceId],
  );

  const handleImportClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await handleFilesDropped(Array.from(files));
      }
    };
    input.click();
  }, [handleFilesDropped]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ContentDropZone onFilesDropped={handleFilesDropped} className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 min-h-11 py-2 px-3 border-b border-border/60 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search docs…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchQuery("");
            }}
            className="h-7 pl-7 pr-7 text-xs"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-1/2 -translate-y-1/2 size-6 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              title="Sort"
            >
              <ChevronsUpDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => {
                setSortBy("name");
                setSortDir((prev) => (sortBy === "name" ? (prev === "asc" ? "desc" : "asc") : "asc"));
              }}
              className={cn(sortBy === "name" && "bg-accent")}
            >
              {sortBy === "name" && sortDir === "desc" ? (
                <ArrowUpAZ className="size-4 mr-2" />
              ) : (
                <ArrowDownAZ className="size-4 mr-2" />
              )}
              Name {sortBy === "name" ? (sortDir === "asc" ? "A-Z" : "Z-A") : ""}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSortBy("created");
                setSortDir((prev) => (sortBy === "created" ? (prev === "asc" ? "desc" : "asc") : "desc"));
              }}
              className={cn(sortBy === "created" && "bg-accent")}
            >
              {sortBy === "created" && sortDir === "asc" ? (
                <ArrowUp01 className="size-4 mr-2" />
              ) : (
                <ArrowDown01 className="size-4 mr-2" />
              )}
              Created {sortBy === "created" ? (sortDir === "desc" ? "newest" : "oldest") : ""}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setSortBy("modified");
                setSortDir((prev) => (sortBy === "modified" ? (prev === "asc" ? "desc" : "asc") : "desc"));
              }}
              className={cn(sortBy === "modified" && "bg-accent")}
            >
              {sortBy === "modified" && sortDir === "asc" ? (
                <ArrowUp01 className="size-4 mr-2" />
              ) : (
                <ArrowDown01 className="size-4 mr-2" />
              )}
              Modified {sortBy === "modified" ? (sortDir === "desc" ? "newest" : "oldest") : ""}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openNewFolderForTreePath("")}>
              <FolderPlus className="size-4 mr-2" />
              New Folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImportClick}>
              <Upload className="size-4 mr-2" />
              Import Files
            </DropdownMenuItem>
            {workspaceBasePath && (
              <DropdownMenuItem onClick={() => revealInFinder(workspaceBasePath)}>
                <FolderOpen className="size-4 mr-2" />
                Open in Finder
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Action row: file count + new doc */}
      <div className="shrink-0 px-3 py-1 flex items-center gap-2 border-b border-border/40">
        <span className="text-xs text-muted-foreground tabular-nums">
          {totalFiles} {totalFiles === 1 ? "file" : "files"}
        </span>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => openNewDocForTreePath("")}
        >
          <Plus className="size-3.5 mr-1" />
          New Doc
        </Button>
      </div>

      {/* Tree */}
      <DocsTree
        workspaceId={workspaceId}
        activeDocId={activeDocId}
        searchQuery={searchQuery}
        sortBy={sortBy}
        sortDir={sortDir}
        onOpenDoc={handleOpenDoc}
        onOpenAsset={handleOpenAsset}
        onCreateDocIn={openNewDocForTreePath}
        onCreateFolderIn={openNewFolderForTreePath}
      />

      {/* New doc modal */}
      <NewDocModal
        open={newDocOpen}
        onClose={() => setNewDocOpen(false)}
        defaultScope={newDocScope}
        defaultWorkspaceId={workspaceId}
        defaultProjectId={newDocProjectId}
        defaultFolderPath={newDocFolderPath}
      />

      {/* New folder dialog */}
      <Dialog open={newFolderOpen} onOpenChange={(o) => !o && setNewFolderOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription className="sr-only">Create a new folder</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolderName.trim()) {
                  void handleSubmitNewFolder();
                }
              }}
              autoFocus
            />
            {newFolderParent && (
              <p className="text-xs text-muted-foreground mt-2">
                Creating in: {displayTreePath(newFolderParent)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitNewFolder}
              disabled={!newFolderName.trim() || creatingFolder}
            >
              {creatingFolder && <Loader2 className="size-4 animate-spin mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentDropZone>
  );
}
