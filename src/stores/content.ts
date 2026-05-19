import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Doc, DocKind, ContentScope, Asset } from "@/types";
import * as contentLib from "@/lib/desk/content";

// Query keys for content (docs, assets, folders)
export const contentKeys = {
  all: ["content"] as const,
  byWorkspace: (workspaceId: string) => [...contentKeys.all, "workspace", workspaceId] as const,
  byProject: (workspaceId: string, projectId: string) =>
    [...contentKeys.byWorkspace(workspaceId), "project", projectId] as const,
  detail: (workspaceId: string, docId: string) =>
    [...contentKeys.byWorkspace(workspaceId), "detail", docId] as const,
  // Tree keys for scoped content trees (kind distinguishes human vs AI docs)
  tree: (scope: ContentScope, workspaceId?: string, projectId?: string, kind: DocKind = "human") =>
    [...contentKeys.all, "tree", scope, workspaceId || "", projectId || "", kind] as const,
  // Workspace overview tree (workspace content + project folders)
  overview: (workspaceId: string, kind: DocKind = "human") =>
    [...contentKeys.byWorkspace(workspaceId), "overview-tree", kind] as const,
};

/**
 * Hook to fetch all docs for a workspace
 */
export function useDocs(workspaceId: string | null) {
  return useQuery({
    queryKey: contentKeys.byWorkspace(workspaceId || ""),
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return contentLib.getDocs(workspaceId);
    },
    enabled: !!workspaceId,
  });
}

/**
 * Hook to fetch docs for a specific project
 */
export function useProjectDocs(workspaceId: string | null, projectId: string | null) {
  return useQuery({
    queryKey: contentKeys.byProject(workspaceId || "", projectId || ""),
    queryFn: async () => {
      if (!workspaceId || !projectId) throw new Error("workspaceId and projectId are required");
      return contentLib.getDocsByProject(workspaceId, projectId);
    },
    enabled: !!workspaceId && !!projectId,
  });
}

/**
 * Hook to fetch a single doc
 */
export function useDoc(workspaceId: string | null, docId: string | null) {
  return useQuery({
    queryKey: contentKeys.detail(workspaceId || "", docId || ""),
    queryFn: async () => {
      if (!workspaceId || !docId) throw new Error("workspaceId and docId are required");
      return contentLib.getDoc(workspaceId, docId);
    },
    enabled: !!workspaceId && !!docId,
  });
}

/**
 * Hook to create a new doc
 */
export function useCreateDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      workspaceId: string;
      projectId: string;
      title: string;
      content?: string;
      templateBody?: string;
      kind?: DocKind;
    }) => contentLib.createDoc(data),
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.byWorkspace(newDoc.workspaceId),
      });
    },
  });
}

/**
 * Hook to update a doc
 * Pass the full doc object - we use its filePath directly
 */
export function useUpdateDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      doc,
      updates,
    }: {
      doc: Doc;
      updates: Partial<Pick<Doc, "title" | "content">>;
    }) => contentLib.updateDoc(doc, updates),
    onSuccess: (updatedDoc) => {
      if (updatedDoc) {
        // Directly update doc in all cached list queries (avoids stale file-tree cache race).
        // Query invalidation alone would trigger a refetch that reads from the still-stale
        // file cache, causing the UI to snap back to old values briefly.
        queryClient.setQueriesData<Doc[]>(
          { queryKey: contentKeys.all },
          (old) => {
            if (!Array.isArray(old)) return old;
            return old.map(d => d.id === updatedDoc.id ? updatedDoc : d);
          }
        );
        // Also update detail query directly
        queryClient.setQueryData(
          contentKeys.detail(updatedDoc.workspaceId, updatedDoc.id),
          updatedDoc
        );
      }
    },
  });
}

/**
 * Hook to delete a doc
 * Pass the full doc object - we use its filePath directly
 */
export function useDeleteDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (doc: Doc) => contentLib.deleteDoc(doc),
    onSuccess: (success, doc) => {
      if (success) {
        // Invalidate workspace-scoped queries
        queryClient.invalidateQueries({
          queryKey: contentKeys.byWorkspace(doc.workspaceId),
        });
        // Also invalidate relevant tree queries
        queryClient.invalidateQueries({
          queryKey: contentKeys.tree("workspace", doc.workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: contentKeys.tree("project", doc.workspaceId, doc.projectId),
        });
      }
    },
  });
}

/**
 * Hook to delete an asset (non-markdown file)
 */
export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (asset: Asset) => contentLib.deleteAsset(asset),
    onSuccess: (success, asset) => {
      if (success) {
        // Invalidate workspace-scoped queries
        queryClient.invalidateQueries({
          queryKey: contentKeys.byWorkspace(asset.workspaceId),
        });
        // Also invalidate relevant tree queries (assets are in tree)
        queryClient.invalidateQueries({
          queryKey: contentKeys.tree("workspace", asset.workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: contentKeys.tree("project", asset.workspaceId, asset.projectId),
        });
      }
    },
  });
}

/**
 * Hook to move a doc to a different project
 */
export function useMoveDocToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      docId,
      workspaceId,
      fromProjectId,
      toProjectId,
    }: {
      docId: string;
      workspaceId: string;
      fromProjectId: string;
      toProjectId: string;
    }) => contentLib.moveDocToProject(docId, workspaceId, fromProjectId, toProjectId),
    onSuccess: (_result, variables) => {
      // Invalidate workspace docs to refresh lists
      queryClient.invalidateQueries({
        queryKey: contentKeys.byWorkspace(variables.workspaceId),
      });
      // Invalidate the detail query so the doc object refreshes with new filePath/projectId
      queryClient.invalidateQueries({
        queryKey: contentKeys.detail(variables.workspaceId, variables.docId),
      });
    },
  });
}

/**
 * Hook to fetch ALL docs for a workspace (includes nested folders)
 * Uses getDocTree internally for proper recursion through folder structures
 */
export function useAllWorkspaceDocs(workspaceId: string | null) {
  return useQuery({
    queryKey: [...contentKeys.byWorkspace(workspaceId || ""), "all-recursive"] as const,
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      return contentLib.getAllDocsForWorkspace(workspaceId);
    },
    enabled: !!workspaceId,
  });
}

// ============================================================================
// Tree-based hooks for scoped content trees
// ============================================================================

/**
 * Hook to fetch a content tree for a given scope
 */
export function useContentTree(
  scope: ContentScope,
  workspaceId?: string | null,
  projectId?: string | null,
  kind: DocKind = "human"
) {
  const enabled =
    scope === "personal" ||
    (scope === "workspace" && !!workspaceId) ||
    (scope === "project" && !!workspaceId && !!projectId);

  return useQuery({
    queryKey: contentKeys.tree(scope, workspaceId || undefined, projectId || undefined, kind),
    queryFn: () =>
      contentLib.getContentTree(
        scope,
        workspaceId || undefined,
        projectId || undefined,
        kind
      ),
    enabled,
  });
}

/**
 * Hook to fetch workspace overview shell (workspace content + project folder stubs).
 * Project content is loaded lazily via useContentTree when folders are expanded.
 */
export function useWorkspaceOverviewShell(workspaceId?: string | null, kind: DocKind = "human") {
  return useQuery({
    queryKey: contentKeys.overview(workspaceId || "", kind),
    queryFn: () => contentLib.getWorkspaceOverviewShell(workspaceId!, kind),
    enabled: !!workspaceId,
  });
}

/**
 * Hook to create a folder in the content tree
 */
export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      folderPath,
      workspaceId,
      projectId,
      kind = "human",
    }: {
      scope: ContentScope;
      folderPath: string;
      workspaceId?: string;
      projectId?: string;
      kind?: DocKind;
    }) => contentLib.createFolder(scope, folderPath, workspaceId, projectId, kind),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
          variables.kind
        ),
      });
    },
  });
}

/**
 * Hook to rename a folder in the content tree
 */
export function useRenameFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      oldPath,
      newName,
      workspaceId,
      projectId,
      kind = "human",
    }: {
      scope: ContentScope;
      oldPath: string;
      newName: string;
      workspaceId?: string;
      projectId?: string;
      kind?: DocKind;
    }) => contentLib.renameFolder(scope, oldPath, newName, workspaceId, projectId, kind),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
          variables.kind
        ),
      });
    },
  });
}

/**
 * Hook to delete a folder from the content tree
 */
export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      folderPath,
      workspaceId,
      projectId,
      kind = "human",
    }: {
      scope: ContentScope;
      folderPath: string;
      workspaceId?: string;
      projectId?: string;
      kind?: DocKind;
    }) => contentLib.deleteFolder(scope, folderPath, workspaceId, projectId, kind),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
          variables.kind
        ),
      });
    },
  });
}

/**
 * Hook to move a folder to a new parent folder
 */
export function useMoveFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      fromPath,
      toParentPath,
      workspaceId,
      projectId,
      kind = "human",
    }: {
      scope: ContentScope;
      fromPath: string;
      toParentPath: string;
      workspaceId?: string;
      projectId?: string;
      kind?: DocKind;
    }) => contentLib.moveFolder(scope, fromPath, toParentPath, workspaceId, projectId, kind),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
          variables.kind
        ),
      });
    },
  });
}

/**
 * Hook to move a doc between folders (within same scope)
 */
export function useMoveDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scope,
      docId,
      fromPath,
      toPath,
      workspaceId,
      projectId,
      fromKind = "human",
      toKind,
    }: {
      scope: ContentScope;
      docId: string;
      fromPath: string;
      toPath: string;
      workspaceId?: string;
      projectId?: string;
      fromKind?: DocKind;
      toKind?: DocKind;
    }) =>
      contentLib.moveDoc(
        scope,
        docId,
        fromPath,
        toPath,
        workspaceId,
        projectId,
        fromKind,
        toKind ?? fromKind
      ),
    onSuccess: (_result, variables) => {
      const fromKind = variables.fromKind ?? "human";
      const toKind = variables.toKind ?? fromKind;
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
          fromKind
        ),
      });
      if (toKind !== fromKind) {
        queryClient.invalidateQueries({
          queryKey: contentKeys.tree(
            variables.scope,
            variables.workspaceId,
            variables.projectId,
            toKind
          ),
        });
      }
    },
  });
}

/**
 * Hook to create a doc in a specific folder
 */
export function useCreateDocInFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      scope: ContentScope;
      title: string;
      content?: string;
      templateBody?: string;
      folderPath?: string;
      workspaceId?: string;
      projectId?: string;
      kind?: DocKind;
    }) => contentLib.createDocInFolder(data),
    onSuccess: (_newDoc, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
          variables.kind
        ),
      });
      // Also invalidate the flat list queries for backward compatibility
      if (variables.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: contentKeys.byWorkspace(variables.workspaceId),
        });
      }
    },
  });
}

/**
 * Hook to import files (docs and assets)
 * - Markdown files are imported as editable docs
 * - Other files are copied as assets (binary)
 */
export function useImportFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      files,
      scope,
      folderPath,
      workspaceId,
      projectId,
      kind = "human",
    }: {
      files: Array<{ name: string; content: string | Uint8Array }>;
      scope: ContentScope;
      folderPath?: string;
      workspaceId?: string;
      projectId?: string;
      kind?: DocKind;
    }) => contentLib.importFiles(files, scope, folderPath, workspaceId, projectId, kind),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: contentKeys.tree(
          variables.scope,
          variables.workspaceId,
          variables.projectId,
          variables.kind
        ),
      });
      // Also invalidate the flat list queries
      if (variables.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: contentKeys.byWorkspace(variables.workspaceId),
        });
      }
    },
  });
}

// Folder AI inclusion hook — re-exported for backwards compatibility
// Canonical location: src/hooks/use-folder-ai-states.ts
export { useFolderAIStates } from "@/hooks/use-folder-ai-states";
