/**
 * Content Import - Import files and create docs in specific folders
 */
import type { Doc, DocKind, ContentScope } from "@/types";
import { isMarkdownFile, isConvertibleFile } from "./file-utils";
import { parseMarkdown, generateFilename, filenameToId, todayISO, generatePreview } from "./parser";
import { isTauri, joinPath } from "./env";
import { getStorage } from "./storage";
import { writeMarkdownFile } from "./file-operations";
import { getContentCache } from "./file-cache";
import { mockDocs } from "./mock-data";
import { WORKSPACE_LEVEL_PROJECT_ID } from "./constants";
import { getDocsPath, getAIDocsPath } from "./paths";
import { getHomeWorkspaceId } from "./workspaces";
import { convertFileToMarkdown } from "./file-conversion";

interface DocFrontmatter extends Record<string, unknown> {
  title: string;
  created: string;
  source?: string;
}

/**
 * Create a doc in a specific folder
 */
export async function createDocInFolder(data: {
  scope: ContentScope;
  title: string;
  content?: string;
  templateBody?: string;
  folderPath?: string;
  workspaceId?: string;
  projectId?: string;
  kind?: DocKind;
}): Promise<Doc> {
  const kind = data.kind || "human";
  const filename = generateFilename(data.title);
  const content = data.content || `# ${data.title}\n\n${data.templateBody || ""}`;
  const homeWorkspaceId = await getHomeWorkspaceId();
  const wsId = data.workspaceId || homeWorkspaceId;
  const projId = data.projectId || (data.scope === "workspace" ? WORKSPACE_LEVEL_PROJECT_ID : homeWorkspaceId);

  const relPath = data.folderPath
    ? `${data.folderPath}/${filename}`
    : filename;
  // ID is the scope-relative path (minus .md) so it matches what the tree
  // derives in content-tree.ts and stays unique across nested folders.
  const id = filenameToId(relPath);

  const doc: Doc = {
    id,
    path: relPath,
    projectId: projId,
    workspaceId: wsId,
    filePath: "",
    title: data.title,
    created: todayISO(),
    content,
    preview: generatePreview(content),
  };

  if (!isTauri()) {
    doc.filePath = `~/Desk/${data.scope}/${data.folderPath || ""}/${filename}`;
    mockDocs.unshift(doc);
    return doc;
  }

  const basePath = kind === "ai"
    ? await getAIDocsPath(data.scope, data.workspaceId, data.projectId)
    : await getDocsPath(data.scope, data.workspaceId, data.projectId);

  const folderPath = data.folderPath
    ? await joinPath(basePath, data.folderPath)
    : basePath;
  await getStorage().mkdir(folderPath);

  const filePath = await joinPath(folderPath, filename);
  doc.filePath = filePath;

  const frontmatter: DocFrontmatter = {
    title: doc.title,
    created: doc.created,
  };

  await writeMarkdownFile(filePath, frontmatter, doc.content);

  return doc;
}

export type ConvertibleAction = "convert" | "keep" | "both";

interface ImportFileFailure {
  name: string;
  reason: string;
}

export interface ImportFilesResult {
  docs: Doc[];
  assets: string[];
  converted: Doc[];
  failures: ImportFileFailure[];
}

/**
 * Import files into a doc folder.
 * - Markdown files (.md, .markdown) → editable docs
 * - Convertible office files (.docx, .pdf, .csv, .xlsx, .html, .rtf, .txt) →
 *   handled per `convertibleAction`: 'convert' (markdown doc), 'keep' (binary asset), 'both'
 * - All other files → binary assets
 */
export async function importFiles(
  files: Array<{ name: string; content: string | Uint8Array }>,
  scope: ContentScope,
  folderPath?: string,
  workspaceId?: string,
  projectId?: string,
  kind: DocKind = "human",
  convertibleAction: ConvertibleAction = "keep",
): Promise<ImportFilesResult> {
  const importedDocs: Doc[] = [];
  const importedAssets: string[] = [];
  const convertedDocs: Doc[] = [];
  const failures: ImportFileFailure[] = [];

  const basePath = kind === "ai"
    ? await getAIDocsPath(scope, workspaceId, projectId)
    : await getDocsPath(scope, workspaceId, projectId);
  const targetDir = folderPath ? await joinPath(basePath, folderPath) : basePath;
  await getStorage().mkdir(targetDir);

  for (const file of files) {
    if (isMarkdownFile(file.name)) {
      await importMarkdownFile(file, {
        scope,
        folderPath,
        workspaceId,
        projectId,
        kind,
        importedDocs,
        failures,
      });
      continue;
    }

    const isConvertible = isConvertibleFile(file.name);

    if (isConvertible && convertibleAction !== "keep") {
      const ok = await importConvertedFile(file, {
        scope,
        folderPath,
        workspaceId,
        projectId,
        kind,
        attachOriginal: convertibleAction === "both" ? file.name : undefined,
        convertedDocs,
        failures,
      });
      if (!ok && convertibleAction === "convert") {
        // Conversion failed and user did not ask to keep originals — skip asset write.
        continue;
      }
    }

    const shouldWriteAsset =
      !isConvertible ||
      convertibleAction === "keep" ||
      convertibleAction === "both";

    if (shouldWriteAsset && isTauri()) {
      try {
        const targetPath = await joinPath(targetDir, file.name);
        if (typeof file.content === "string") {
          await getStorage().writeTextFile(targetPath, file.content);
        } else {
          await getStorage().writeFile(targetPath, file.content);
        }
        getContentCache().invalidate(targetPath);
        importedAssets.push(file.name);
      } catch (err) {
        failures.push({ name: file.name, reason: errorMessage(err) });
      }
    }
  }

  return { docs: importedDocs, assets: importedAssets, converted: convertedDocs, failures };
}

async function importMarkdownFile(
  file: { name: string; content: string | Uint8Array },
  ctx: {
    scope: ContentScope;
    folderPath?: string;
    workspaceId?: string;
    projectId?: string;
    kind: DocKind;
    importedDocs: Doc[];
    failures: ImportFileFailure[];
  },
): Promise<void> {
  try {
    const textContent = typeof file.content === "string"
      ? file.content
      : new TextDecoder().decode(file.content);

    let title: string;
    try {
      const parsed = parseMarkdown<{ title?: string }>(textContent);
      title = parsed.data.title || file.name.replace(/\.(md|markdown|txt)$/i, "");
    } catch {
      title = file.name.replace(/\.(md|markdown|txt)$/i, "");
    }

    const doc = await createDocInFolder({
      scope: ctx.scope,
      title,
      content: textContent,
      folderPath: ctx.folderPath,
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId,
      kind: ctx.kind,
    });
    ctx.importedDocs.push(doc);
  } catch (err) {
    ctx.failures.push({ name: file.name, reason: errorMessage(err) });
  }
}

async function importConvertedFile(
  file: { name: string; content: string | Uint8Array },
  ctx: {
    scope: ContentScope;
    folderPath?: string;
    workspaceId?: string;
    projectId?: string;
    kind: DocKind;
    attachOriginal?: string;
    convertedDocs: Doc[];
    failures: ImportFileFailure[];
  },
): Promise<boolean> {
  try {
    const bytes = typeof file.content === "string"
      ? new TextEncoder().encode(file.content)
      : file.content;

    const result = await convertFileToMarkdown(file.name, bytes);

    const body = ctx.attachOriginal
      ? `${result.markdown}\n\n---\n\n_Original file: [${ctx.attachOriginal}](./${encodeURIComponent(ctx.attachOriginal)})_\n`
      : result.markdown;

    const doc = await createDocInFolder({
      scope: ctx.scope,
      title: result.title,
      content: body,
      folderPath: ctx.folderPath,
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId,
      kind: ctx.kind,
    });
    ctx.convertedDocs.push(doc);
    return true;
  } catch (err) {
    console.error(`[file-conversion] failed for ${file.name}:`, err);
    ctx.failures.push({ name: file.name, reason: errorMessage(err) });
    return false;
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
