/**
 * Content Import - Import files and create docs in specific folders
 */
import type { Doc, ContentScope } from "../types";
import { isMarkdownFile, isConvertibleFile } from "./file-utils";
import { parseMarkdown, generateFilename, filenameToId, todayISO, generatePreview } from "./parser";
import { isMockMode, joinPath } from "./env";
import { getStorage } from "./storage";
import {
  allocateUniqueFilePath,
  allocateUniqueName,
  writeMarkdownFile,
} from "./file-operations";
import { getContentCache } from "./file-cache";
import { mockDocs } from "./mock-data";
import { WORKSPACE_LEVEL_PROJECT_ID } from "./constants";
import { getDocsPath } from "./paths";
import { getHomeWorkspaceId } from "./workspaces";
import { convertFileToMarkdown } from "./file-conversion";

interface DocFrontmatter extends Record<string, unknown> {
  title: string;
  /** Absent when the file carries no date. Docs created here always get one. */
  created?: string;
  updated?: string;
  source?: string;
  author?: "ai";
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
  /** Override the generated `YYYY-MM-DD-<title-slug>.md` filename. */
  filename?: string;
  /** Stamp `author: ai` on app-created AI files. Absent = user. */
  author?: "ai";
  /** Explicit `updated` stamp instead of write-time (e.g. a snapshot's read-time). */
  updatedStamp?: string;
}): Promise<Doc> {
  const preferredFilename = data.filename || generateFilename(data.title);
  const content = data.content || `# ${data.title}\n\n${data.templateBody || ""}`;
  const homeWorkspaceId = await getHomeWorkspaceId();
  const wsId = data.workspaceId || homeWorkspaceId;
  const projId = data.projectId || (data.scope === "workspace" ? WORKSPACE_LEVEL_PROJECT_ID : homeWorkspaceId);
  const scopeSegment = data.scope === "workspace" ? "" : `/projects/${projId}`;
  const folderSegment = data.folderPath ? `/${data.folderPath}` : "";
  const mockDirectory = `~/DeskMD/workspaces/${wsId}${scopeSegment}/docs${folderSegment}`;
  let filename: string;
  let filePath: string;

  if (isMockMode()) {
    filename = await allocateUniqueName(preferredFilename, (candidate) =>
      mockDocs.some((doc) => doc.filePath === `${mockDirectory}/${candidate}`)
    );
    filePath = `${mockDirectory}/${filename}`;
  } else {
    const basePath = await getDocsPath(data.scope, data.workspaceId, data.projectId);
    const folderPath = data.folderPath
      ? await joinPath(basePath, data.folderPath)
      : basePath;
    await getStorage().mkdir(folderPath);
    ({ filename, filePath } = await allocateUniqueFilePath(folderPath, preferredFilename));
  }

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
    filePath,
    title: data.title,
    created: todayISO(),
    content,
    preview: generatePreview(content),
    ...(data.author ? { author: data.author } : {}),
  };

  if (isMockMode()) {
    mockDocs.unshift(doc);
    return doc;
  }

  const frontmatter: DocFrontmatter = {
    title: doc.title,
    created: doc.created,
    ...(data.author ? { author: data.author } : {}),
  };

  await writeMarkdownFile(filePath, frontmatter, doc.content, {
    updatedStamp: data.updatedStamp,
  });

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
  convertibleAction: ConvertibleAction = "keep",
): Promise<ImportFilesResult> {
  const importedDocs: Doc[] = [];
  const importedAssets: string[] = [];
  const convertedDocs: Doc[] = [];
  const failures: ImportFileFailure[] = [];

  const basePath = await getDocsPath(scope, workspaceId, projectId);
  const targetDir = folderPath ? await joinPath(basePath, folderPath) : basePath;
  await getStorage().mkdir(targetDir);

  for (const file of files) {
    if (isMarkdownFile(file.name)) {
      await importMarkdownFile(file, {
        scope,
        folderPath,
        workspaceId,
        projectId,
        importedDocs,
        failures,
      });
      continue;
    }

    const isConvertible = isConvertibleFile(file.name);
    const shouldWriteAsset =
      !isConvertible ||
      convertibleAction === "keep" ||
      convertibleAction === "both";
    let assetTarget: Awaited<ReturnType<typeof allocateUniqueFilePath>> | null = null;
    if (shouldWriteAsset && !isMockMode()) {
      try {
        assetTarget = await allocateUniqueFilePath(targetDir, file.name);
      } catch (err) {
        failures.push({ name: file.name, reason: errorMessage(err) });
        continue;
      }
    }

    if (isConvertible && convertibleAction !== "keep") {
      const ok = await importConvertedFile(file, {
        scope,
        folderPath,
        workspaceId,
        projectId,
        attachOriginal: convertibleAction === "both"
          ? assetTarget?.filename ?? file.name
          : undefined,
        convertedDocs,
        failures,
      });
      if (!ok && convertibleAction === "convert") {
        // Conversion failed and user did not ask to keep originals — skip asset write.
        continue;
      }
    }

    if (shouldWriteAsset && !isMockMode()) {
      try {
        if (!assetTarget) {
          throw new Error(`Asset path was not allocated: ${file.name}`);
        }
        const { filename, filePath: targetPath } = assetTarget;
        if (typeof file.content === "string") {
          await getStorage().writeTextFile(targetPath, file.content);
        } else {
          await getStorage().writeFile(targetPath, file.content);
        }
        getContentCache().invalidate(targetPath);
        importedAssets.push(filename);
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
    importedDocs: Doc[];
    failures: ImportFileFailure[];
  },
): Promise<void> {
  try {
    const textContent = typeof file.content === "string"
      ? file.content
      : new TextDecoder().decode(file.content);

    let title: string;
    let body = textContent;
    let author: "ai" | undefined;
    try {
      const parsed = parseMarkdown<Record<string, unknown>>(textContent);
      title = typeof parsed.data.title === "string" && parsed.data.title.trim()
        ? parsed.data.title
        : file.name.replace(/\.(md|markdown|txt)$/i, "");
      body = parsed.content;
      author = parsed.data.author === "ai" ? "ai" : undefined;
    } catch {
      title = file.name.replace(/\.(md|markdown|txt)$/i, "");
    }

    const doc = await createDocInFolder({
      scope: ctx.scope,
      title,
      content: body,
      author,
      folderPath: ctx.folderPath,
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId,
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
