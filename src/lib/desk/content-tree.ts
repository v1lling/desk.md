/**
 * Content Tree - Tree building, extraction, and flat doc access
 */
import type { Doc, DocKind, FileTreeNode, ContentScope, Asset } from "@/types";
import { isMarkdownFile, getExtension } from "./file-utils";
import { parseMarkdown, filenameToId, normalizeDate, generatePreview } from "./parser";
import { isTauri, readDir, mkdir, joinPath, exists, fileStat } from "./tauri-fs";
import { mockDocs } from "./mock-data";
import { SPECIAL_DIRS, PATH_SEGMENTS, WORKSPACE_LEVEL_PROJECT_ID } from "./constants";
import { getHomeWorkspaceId } from "./workspaces";
import { getDocsPath, getAIDocsPath, getProjectsPath } from "./paths";
import { getFileTreeService } from "./file-cache";
import { getProjects } from "./projects";
import { AI_DOCS_FOLDER_NAME, AI_DOCS_SENTINEL, filePathIsAIKind } from "./tree-path";

/** Resolve base path for docs or ai-docs based on kind */
function getBasePath(kind: DocKind, scope: ContentScope, workspaceId?: string, projectId?: string) {
  return kind === "ai"
    ? getAIDocsPath(scope, workspaceId, projectId)
    : getDocsPath(scope, workspaceId, projectId);
}

interface DocFrontmatter {
  title: string;
  created: string;
}

/**
 * Generate a unique key for a tree node (for React rendering)
 */
export function getNodeKey(node: FileTreeNode): string {
  switch (node.type) {
    case 'folder':
      return `folder-${node.folder.path}`;
    case 'doc':
      return `doc-${node.doc.id}`;
    case 'asset':
      return `asset-${node.asset.path}`;
  }
}

/**
 * Recursively build a content tree from a directory
 */
async function buildContentTreeRecursive(
  basePath: string,
  relativePath: string,
  _scope: ContentScope,
  workspaceId: string,
  projectId: string,
  kind: DocKind = "human"
): Promise<FileTreeNode[]> {
  const currentPath = relativePath
    ? await joinPath(basePath, relativePath)
    : basePath;

  if (!(await exists(currentPath))) {
    return [];
  }

  const entries = await readDir(currentPath);
  const nodes: FileTreeNode[] = [];

  const folders = entries.filter(
    (e) => e.isDirectory && !e.name.startsWith(".")
  );
  const allFiles = entries.filter((e) => e.isFile && !e.name.startsWith("."));
  const markdownFiles = allFiles.filter((e) => isMarkdownFile(e.name));
  const assetFiles = allFiles.filter((e) => !isMarkdownFile(e.name));

  // Process folders first (sorted alphabetically)
  folders.sort((a, b) => a.name.localeCompare(b.name));
  for (const folder of folders) {
    const folderRelPath = relativePath
      ? `${relativePath}/${folder.name}`
      : folder.name;

    const children = await buildContentTreeRecursive(
      basePath,
      folderRelPath,
      _scope,
      workspaceId,
      projectId,
      kind
    );

    nodes.push({
      type: "folder",
      folder: {
        name: folder.name,
        path: folderRelPath,
        children,
      },
    });
  }

  // Process markdown files (sorted by name)
  const fileTreeService = getFileTreeService();
  markdownFiles.sort((a, b) => a.name.localeCompare(b.name));
  for (const file of markdownFiles) {
    try {
      const filePath = await joinPath(currentPath, file.name);

      const content = await fileTreeService.getContentByAbsolutePath<string>(
        filePath,
        (raw) => raw
      );

      if (!content) {
        console.warn(`Failed to read doc ${file.name}: no content`);
        continue;
      }

      const { data, content: body } = parseMarkdown<DocFrontmatter>(content);

      const docRelPath = relativePath
        ? `${relativePath}/${file.name}`
        : file.name;

      // Get OS file dates
      const stats = await fileStat(filePath);
      const fileCreated = stats?.birthtime?.toISOString();
      const fileModified = stats?.mtime?.toISOString();

      nodes.push({
        type: "doc",
        doc: {
          id: filenameToId(file.name),
          path: docRelPath,
          projectId,
          workspaceId,
          filePath,
          title: data.title || file.name.replace(".md", ""),
          created: normalizeDate(data.created),
          content: body,
          preview: generatePreview(body),
          fileCreated,
          fileModified,
        },
      });
    } catch (e) {
      console.warn(`Failed to read doc ${file.name}:`, e);
    }
  }

  // Process asset files (non-markdown, metadata only)
  assetFiles.sort((a, b) => a.name.localeCompare(b.name));
  for (const file of assetFiles) {
    const filePath = await joinPath(currentPath, file.name);
    const ext = getExtension(file.name);
    const assetRelPath = relativePath
      ? `${relativePath}/${file.name}`
      : file.name;

    // Get OS file dates
    const stats = await fileStat(filePath);
    const fileCreated = stats?.birthtime?.toISOString();
    const fileModified = stats?.mtime?.toISOString();

    nodes.push({
      type: "asset",
      asset: {
        id: file.name,
        path: assetRelPath,
        projectId,
        workspaceId,
        filePath,
        extension: ext || '',
        fileCreated,
        fileModified,
      },
    });
  }

  return nodes;
}

/**
 * Get a content tree for a given scope
 */
export async function getContentTree(
  scope: ContentScope,
  workspaceId?: string,
  projectId?: string,
  kind: DocKind = "human"
): Promise<FileTreeNode[]> {
  const homeWorkspaceId = await getHomeWorkspaceId();

  if (!isTauri()) {
    const filtered = mockDocs.filter((doc) => {
      const docKind: DocKind = filePathIsAIKind(doc.filePath) ? "ai" : "human";
      if (docKind !== kind) return false;
      if (scope === "personal") return doc.workspaceId === homeWorkspaceId;
      if (scope === "workspace") return doc.workspaceId === workspaceId && doc.projectId === WORKSPACE_LEVEL_PROJECT_ID;
      return doc.workspaceId === workspaceId && doc.projectId === projectId;
    });

    return filtered.map((doc) => ({
      type: "doc" as const,
      doc,
    }));
  }

  const basePath = await getBasePath(kind, scope, workspaceId, projectId);

  // Skip directories that haven't been created yet — first write will create them.
  if (!(await exists(basePath))) {
    return [];
  }

  return buildContentTreeRecursive(
    basePath,
    "",
    scope,
    workspaceId || homeWorkspaceId,
    projectId || (scope === "workspace" ? WORKSPACE_LEVEL_PROJECT_ID : homeWorkspaceId),
    kind
  );
}

// ============================================================================
// Tree Extraction Utilities
// ============================================================================

/**
 * Extract all docs from a file tree (recursive)
 */
export function extractDocs(nodes: FileTreeNode[]): Doc[] {
  const docs: Doc[] = [];

  for (const node of nodes) {
    if (node.type === "doc") {
      docs.push(node.doc);
    } else if (node.type === "folder" && node.folder.children) {
      docs.push(...extractDocs(node.folder.children));
    }
  }

  return docs;
}

/**
 * Extract all assets from a file tree (recursive)
 */
export function extractAssets(nodes: FileTreeNode[]): Asset[] {
  const assets: Asset[] = [];

  for (const node of nodes) {
    if (node.type === "asset") {
      assets.push(node.asset);
    } else if (node.type === "folder" && node.folder.children) {
      assets.push(...extractAssets(node.folder.children));
    }
  }

  return assets;
}

/**
 * Extract all folder paths from a file tree (recursive)
 */
export function extractFolderPaths(nodes: FileTreeNode[]): string[] {
  const paths: string[] = [];

  for (const node of nodes) {
    if (node.type === "folder") {
      paths.push(node.folder.path);
      if (node.folder.children) {
        paths.push(...extractFolderPaths(node.folder.children));
      }
    }
  }

  return paths;
}

// ============================================================================
// Flat Doc Access (using tree internally for full recursion)
// ============================================================================

/**
 * Get all docs for a scope as a flat array (includes nested folders)
 */
export async function getAllDocs(
  scope: ContentScope,
  workspaceId?: string,
  projectId?: string,
  kind: DocKind = "human"
): Promise<Doc[]> {
  const tree = await getContentTree(scope, workspaceId, projectId, kind);
  const docs = extractDocs(tree);
  docs.sort((a, b) => b.created.localeCompare(a.created));
  return docs;
}

/**
 * Get all docs for a workspace across all projects (includes nested folders)
 */
export async function getAllDocsForWorkspace(workspaceId: string, kind: DocKind = "human"): Promise<Doc[]> {
  if (!isTauri()) {
    return mockDocs.filter((doc) => {
      const docKind: DocKind = filePathIsAIKind(doc.filePath) ? "ai" : "human";
      return doc.workspaceId === workspaceId && docKind === kind;
    });
  }

  const allDocs: Doc[] = [];

  // 1. Get workspace-level docs
  const workspaceDocs = await getAllDocs("workspace", workspaceId, undefined, kind);
  allDocs.push(...workspaceDocs);

  // 2. Get all project docs
  const projectsPath = await getProjectsPath(workspaceId);

  if (await exists(projectsPath)) {
    const projectEntries = await readDir(projectsPath);

    for (const entry of projectEntries) {
      if (entry.isDirectory && !entry.name.startsWith(".") && entry.name !== SPECIAL_DIRS.UNASSIGNED) {
        const projectDocs = await getAllDocs("project", workspaceId, entry.name, kind);
        allDocs.push(...projectDocs);
      }
    }
  }

  // 3. Get unassigned docs
  const unassignedDocs = await getAllDocs("project", workspaceId, SPECIAL_DIRS.UNASSIGNED, kind);
  allDocs.push(...unassignedDocs);

  allDocs.sort((a, b) => b.created.localeCompare(a.created));
  return allDocs;
}

/**
 * Get a workspace overview shell: workspace-level content + project folder stubs.
 * Project folders have children: [] — content is loaded lazily by the component on expand.
 */
export async function getWorkspaceOverviewShell(workspaceId: string, kind: DocKind = "human"): Promise<FileTreeNode[]> {
  if (!isTauri()) {
    // Mock mode: workspace docs + project folder stubs, filtered to the requested kind
    const workspaceDocs = mockDocs.filter((doc) => {
      const docKind: DocKind = filePathIsAIKind(doc.filePath) ? "ai" : "human";
      return (
        doc.workspaceId === workspaceId &&
        doc.projectId === WORKSPACE_LEVEL_PROJECT_ID &&
        docKind === kind
      );
    });
    const workspaceNodes: FileTreeNode[] = workspaceDocs.map((doc) => ({ type: "doc" as const, doc }));

    // Get unique project IDs and count docs per project (across both kinds — counts are kind-agnostic in the project stub)
    const projectDocs = mockDocs.filter(
      (doc) => doc.workspaceId === workspaceId && doc.projectId !== WORKSPACE_LEVEL_PROJECT_ID
    );
    const projectCounts = new Map<string, number>();
    for (const doc of projectDocs) {
      projectCounts.set(doc.projectId, (projectCounts.get(doc.projectId) || 0) + 1);
    }
    const projectFolders: FileTreeNode[] = Array.from(projectCounts.entries()).map(([projectId, count]) => ({
      type: "folder" as const,
      folder: {
        name: projectId,
        path: `_project/${projectId}`,
        children: [],  // Lazy loaded on expand
        isProject: true,
        projectId,
        docCount: count,
        assetCount: 0,
      },
    }));

    return [...workspaceNodes, ...projectFolders];
  }

  // 1. Get workspace-level tree for the given kind
  const workspaceTree = await getContentTree("workspace", workspaceId, undefined, kind);

  // 2. Get project metadata (counts already computed by getProjects)
  const projects = await getProjects(workspaceId);
  const activeProjects = projects
    .filter((p) => p.status !== "archived")
    .sort((a, b) => a.name.localeCompare(b.name));

  // 3. Create shell folder nodes — NO getContentTree calls per project
  // Note: docCount from project metadata only counts human docs.
  // AI doc counts would need a separate query; for now stubs show human counts.
  const projectFolders: FileTreeNode[] = activeProjects.map((project) => ({
    type: "folder" as const,
    folder: {
      name: project.name,
      path: `_project/${project.id}`,
      children: [],  // Lazy loaded on expand
      isProject: true,
      projectId: project.id,
      docCount: project.docCount ?? 0,
      assetCount: 0,
    },
  }));

  return [...workspaceTree, ...projectFolders];
}

// ============================================================================
// Merged Tree (UI Flattening of docs/ + ai-docs/)
// ============================================================================

/**
 * Recursively prefix folder paths in a subtree. Used when splicing one tree into another
 * (AI subtree under `__ai-docs__`, project subtree under `_project/{id}`) so the resulting
 * folder paths are globally unique within the combined tree.
 *
 * Asymmetry: only folder `path` fields are rewritten here. Doc/asset `path` stays as the
 * on-disk relative path (those leaves are addressed via `filePath`, and the arborist adapter
 * derives a leaf's tree-id by joining the already-prefixed parent treePath with the leaf id).
 */
export function prefixSubtreePaths(nodes: FileTreeNode[], prefix: string): FileTreeNode[] {
  if (!prefix) return nodes;
  return nodes.map((node) => {
    if (node.type !== "folder") return node;
    return {
      type: "folder" as const,
      folder: {
        ...node.folder,
        path: `${prefix}/${node.folder.path}`,
        children: prefixSubtreePaths(node.folder.children, prefix),
      },
    };
  });
}

/**
 * Build the synthetic "AI Docs" folder node containing the (prefixed) AI subtree.
 * Always renders — even when empty — so the user has a target to create the first AI doc.
 */
function buildAIDocsFolder(aiTree: FileTreeNode[]): FileTreeNode {
  const prefixedChildren = prefixSubtreePaths(aiTree, AI_DOCS_SENTINEL);
  return {
    type: "folder",
    folder: {
      name: AI_DOCS_FOLDER_NAME,
      path: AI_DOCS_SENTINEL,
      children: prefixedChildren,
    },
  };
}

/**
 * Fetch a merged content tree for a scope. Human docs sit at the root; AI docs appear
 * inside a synthetic "AI Docs" subfolder. Used by the new /docs UI.
 */
export async function getMergedContentTree(
  scope: ContentScope,
  workspaceId?: string,
  projectId?: string,
): Promise<FileTreeNode[]> {
  const [humanTree, aiTree] = await Promise.all([
    getContentTree(scope, workspaceId, projectId, "human"),
    getContentTree(scope, workspaceId, projectId, "ai"),
  ]);
  return [...humanTree, buildAIDocsFolder(aiTree)];
}

/**
 * Fetch the workspace overview shell with human + AI merged. Project stubs remain
 * lazy-loaded; on expand the consumer calls `getMergedContentTree("project", ws, projId)`.
 */
export async function getMergedWorkspaceOverviewShell(workspaceId: string): Promise<FileTreeNode[]> {
  const [humanShell, aiTree] = await Promise.all([
    getWorkspaceOverviewShell(workspaceId, "human"),
    // AI side: only need the workspace-level AI docs tree, not project stubs (those come from the human shell).
    getContentTree("workspace", workspaceId, undefined, "ai"),
  ]);

  // Separate workspace-level nodes from project stubs in the human shell to keep order.
  const humanWorkspaceNodes = humanShell.filter(
    (n) => n.type !== "folder" || !n.folder.isProject,
  );
  const projectStubs = humanShell.filter(
    (n) => n.type === "folder" && n.folder.isProject,
  );

  return [...humanWorkspaceNodes, buildAIDocsFolder(aiTree), ...projectStubs];
}
