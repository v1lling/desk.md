import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown01,
  ArrowDownAZ,
  ArrowUp01,
  ArrowUpAZ,
  FolderOpen,
  FolderPlus,
  Loader2,
  Upload,
} from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ListPane, type ListPaneSortOption } from "@/components/patterns";
import { countTreeFiles } from "@/lib/tree-count";
import type { Asset, Doc } from "@desk/core/types";
import {
  useCreateFolder,
  useImportFiles,
  useMergedWorkspaceOverviewShell,
  useOpenTab,
  useTabStore,
} from "@/stores";
import { isMarkdownFile } from "@desk/core";
import { isTauri } from "@desk/core";
import { getDocsPath } from "@desk/core";
import {
  displayTreePath,
  resolveTreePath,
  splitTreePathToKind,
} from "@desk/core";
import { isAllowedNewFolderName } from "./tree/arborist-adapter";
import { revealInFinder, openWithDefaultApp, type DocSortBy } from "./tree-item-utils";
import { isRemoteMode } from "@/lib/connection";
import { ContentDropZone } from "./content-drop-zone";
import { NewDocModal } from "./new-doc-modal";
import { DocsTree } from "./tree/docs-tree";
import { ConvertFilesDialog, type ConvertChoice } from "./convert-files-dialog";
import { isConvertibleFile } from "@desk/core";

interface DocsTreePaneProps {
  workspaceId: string;
}

export function DocsTreePane({ workspaceId }: DocsTreePaneProps) {
  const { t } = useTranslation();
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

  // ── Convert-files dialog state ──────────────────────────────────────────────
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertDialogFiles, setConvertDialogFiles] = useState<string[]>([]);
  const convertChoiceResolverRef = useRef<((choice: ConvertChoice | null) => void) | null>(null);

  // ── File count ──────────────────────────────────────────────────────────────
  const totalFiles = useMemo(() => countTreeFiles(overviewTree), [overviewTree]);

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
    // Open with default app — same behavior as the old tree. Routes through the shared
    // helper so it's guarded in remote mode (the file lives on the server, not this Mac).
    void openWithDefaultApp(asset.filePath);
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
      toast.error(t("errors.folder.reservedName", { name: trimmed }));
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
      toast.error(t("errors.folder.createFailed"));
    } finally {
      setCreatingFolder(false);
    }
  }, [newFolderName, newFolderParent, createFolder, workspaceId, t]);

  // ── Imports (OS drag-drop + button) ─────────────────────────────────────────

  const askConvertChoice = useCallback(
    (filenames: string[]): Promise<ConvertChoice | null> => {
      return new Promise((resolve) => {
        convertChoiceResolverRef.current = resolve;
        setConvertDialogFiles(filenames);
        setConvertDialogOpen(true);
      });
    },
    [],
  );

  const resolveConvertChoice = useCallback((choice: ConvertChoice | null) => {
    const resolver = convertChoiceResolverRef.current;
    convertChoiceResolverRef.current = null;
    setConvertDialogOpen(false);
    setConvertDialogFiles([]);
    resolver?.(choice);
  }, []);

  const handleFilesDropped = useCallback(
    async (files: File[], targetTreePath: string | null) => {
      try {
        const convertibles = files.filter(
          (f) => !isMarkdownFile(f.name) && isConvertibleFile(f.name),
        );

        let convertibleAction: ConvertChoice = "keep";
        if (convertibles.length > 0) {
          const choice = await askConvertChoice(convertibles.map((f) => f.name));
          if (choice === null) return;
          convertibleAction = choice;
        }

        // Resolve the drop target to scope/project/folder. Dropping on empty
        // space (null) or the workspace root targets the workspace docs root.
        const resolved = resolveTreePath(targetTreePath ?? "");
        const { kind, subPath } = splitTreePathToKind(resolved.scopeTreePath);

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
          scope: resolved.scope,
          folderPath: subPath || undefined,
          workspaceId,
          projectId: resolved.projectId,
          kind,
          convertibleAction,
        });

        const importedDocs = result.docs.length;
        const convertedDocs = result.converted.length;
        const docTotal = importedDocs + convertedDocs;
        const importedAssets = result.assets.length;
        const failedCount = result.failures.length;

        if (docTotal > 0 && importedAssets > 0) {
          toast.success(
            t("toasts.doc.importMixed", { docs: docTotal, files: importedAssets }),
          );
        } else if (docTotal > 0) {
          toast.success(t("toasts.doc.importDocs", { count: docTotal }));
        } else if (importedAssets > 0) {
          toast.success(t("toasts.doc.importFiles", { count: importedAssets }));
        }

        if (failedCount > 0) {
          const firstFailure = result.failures[0];
          toast.error(
            t("toasts.doc.convertFailed", {
              count: failedCount,
              name: firstFailure.name,
            }),
          );
        }
      } catch (err) {
        console.error("Failed to import files:", err);
        toast.error(t("errors.doc.importFailed"));
      }
    },
    [importFiles, workspaceId, t, askConvertChoice],
  );

  const handleImportClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await handleFilesDropped(Array.from(files), null);
      }
    };
    input.click();
  }, [handleFilesDropped]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const sortOptions: ListPaneSortOption[] = [
    {
      key: "name",
      label: (
        <>
          {t("pages.docs.tree.sort.name")}{" "}
          {sortBy === "name"
            ? sortDir === "asc"
              ? t("pages.docs.tree.sort.nameAsc")
              : t("pages.docs.tree.sort.nameDesc")
            : ""}
        </>
      ),
      icon: sortBy === "name" && sortDir === "desc" ? ArrowUpAZ : ArrowDownAZ,
      active: sortBy === "name",
      onSelect: () => {
        setSortBy("name");
        setSortDir((prev) => (sortBy === "name" ? (prev === "asc" ? "desc" : "asc") : "asc"));
      },
    },
    {
      key: "created",
      label: (
        <>
          {t("pages.docs.tree.sort.created")}{" "}
          {sortBy === "created"
            ? sortDir === "desc"
              ? t("pages.docs.tree.sort.newest")
              : t("pages.docs.tree.sort.oldest")
            : ""}
        </>
      ),
      icon: sortBy === "created" && sortDir === "asc" ? ArrowUp01 : ArrowDown01,
      active: sortBy === "created",
      onSelect: () => {
        setSortBy("created");
        setSortDir((prev) => (sortBy === "created" ? (prev === "asc" ? "desc" : "asc") : "desc"));
      },
    },
    {
      key: "modified",
      label: (
        <>
          {t("pages.docs.tree.sort.modified")}{" "}
          {sortBy === "modified"
            ? sortDir === "desc"
              ? t("pages.docs.tree.sort.newest")
              : t("pages.docs.tree.sort.oldest")
            : ""}
        </>
      ),
      icon: sortBy === "modified" && sortDir === "asc" ? ArrowUp01 : ArrowDown01,
      active: sortBy === "modified",
      onSelect: () => {
        setSortBy("modified");
        setSortDir((prev) => (sortBy === "modified" ? (prev === "asc" ? "desc" : "asc") : "desc"));
      },
    },
  ];

  return (
    <ContentDropZone onFilesDropped={handleFilesDropped} className="flex flex-col h-full">
      <ListPane
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t("pages.docs.tree.searchPlaceholder")}
        sortOptions={sortOptions}
        menuItems={
          <>
            <DropdownMenuItem onClick={() => openNewFolderForTreePath("")}>
              <FolderPlus className="size-4 mr-2" />
              {t("pages.docs.tree.actions.newFolder")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImportClick}>
              <Upload className="size-4 mr-2" />
              {t("pages.docs.tree.actions.importFiles")}
            </DropdownMenuItem>
            {workspaceBasePath && !isRemoteMode() && (
              <DropdownMenuItem onClick={() => revealInFinder(workspaceBasePath)}>
                <FolderOpen className="size-4 mr-2" />
                {t("pages.docs.tree.actions.openInFinder")}
              </DropdownMenuItem>
            )}
          </>
        }
        countLabel={t("pages.docs.tree.fileCount", { count: totalFiles })}
        action={{
          label: t("pages.docs.tree.actions.newDoc"),
          onClick: () => openNewDocForTreePath(""),
        }}
        scroll={false}
        className="flex-1"
      >
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
      </ListPane>

      {/* New doc modal */}
      <NewDocModal
        open={newDocOpen}
        onClose={() => setNewDocOpen(false)}
        defaultScope={newDocScope}
        defaultWorkspaceId={workspaceId}
        defaultProjectId={newDocProjectId}
        defaultFolderPath={newDocFolderPath}
      />

      {/* Convert files dialog */}
      <ConvertFilesDialog
        open={convertDialogOpen}
        filenames={convertDialogFiles}
        onChoice={(choice) => resolveConvertChoice(choice)}
        onCancel={() => resolveConvertChoice(null)}
      />

      {/* New folder dialog */}
      <Dialog open={newFolderOpen} onOpenChange={(o) => !o && setNewFolderOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pages.docs.tree.newFolderDialog.title")}</DialogTitle>
            <DialogDescription className="sr-only">{t("pages.docs.tree.newFolderDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder={t("pages.docs.tree.newFolderDialog.placeholder")}
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
                {t("pages.docs.tree.newFolderDialog.creatingIn", { path: displayTreePath(newFolderParent) })}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              {t("common.buttons.cancel")}
            </Button>
            <Button
              onClick={handleSubmitNewFolder}
              disabled={!newFolderName.trim() || creatingFolder}
            >
              {creatingFolder && <Loader2 className="size-4 animate-spin mr-2" />}
              {t("common.buttons.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentDropZone>
  );
}
