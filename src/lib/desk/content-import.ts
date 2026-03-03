/**
 * Content Import - Import files and create docs in specific folders
 */
import type { Doc, ContentScope } from "@/types";
import { isMarkdownFile } from "./file-utils";
import { parseMarkdown, generateFilename, filenameToId, todayISO, generatePreview } from "./parser";
import { isTauri, joinPath } from "./tauri-fs";
import { writeMarkdownFile } from "./file-operations";
import { mockDocs } from "./mock-data";
import { PERSONAL_WORKSPACE_ID, WORKSPACE_LEVEL_PROJECT_ID } from "./constants";
import { getDocsPath } from "./paths";
import { mkdir } from "./tauri-fs";

interface DocFrontmatter extends Record<string, unknown> {
  title: string;
  created: string;
}

/**
 * Create a doc in a specific folder
 */
export async function createDocInFolder(data: {
  scope: ContentScope;
  title: string;
  content?: string;
  folderPath?: string;
  workspaceId?: string;
  projectId?: string;
}): Promise<Doc> {
  const filename = generateFilename(data.title);
  const id = filenameToId(filename);
  const content = data.content || `# ${data.title}\n\n`;
  const wsId = data.workspaceId || PERSONAL_WORKSPACE_ID;
  const projId = data.projectId || (data.scope === "workspace" ? WORKSPACE_LEVEL_PROJECT_ID : PERSONAL_WORKSPACE_ID);

  const relPath = data.folderPath
    ? `${data.folderPath}/${filename}`
    : filename;

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

  const basePath = await getDocsPath(data.scope, data.workspaceId, data.projectId);

  const folderPath = data.folderPath
    ? await joinPath(basePath, data.folderPath)
    : basePath;
  await mkdir(folderPath);

  const filePath = await joinPath(folderPath, filename);
  doc.filePath = filePath;

  const frontmatter: DocFrontmatter = {
    title: doc.title,
    created: doc.created,
  };

  await writeMarkdownFile(filePath, frontmatter, doc.content);

  return doc;
}

/**
 * Import files into a doc folder
 * - Markdown files (.md, .markdown) are imported as editable docs
 * - Other files are copied as assets (binary)
 */
export async function importFiles(
  files: Array<{ name: string; content: string | Uint8Array }>,
  scope: ContentScope,
  folderPath?: string,
  workspaceId?: string,
  projectId?: string
): Promise<{ docs: Doc[]; assets: string[] }> {
  const importedDocs: Doc[] = [];
  const importedAssets: string[] = [];

  const basePath = await getDocsPath(scope, workspaceId, projectId);
  const targetDir = folderPath ? await joinPath(basePath, folderPath) : basePath;
  await mkdir(targetDir);

  for (const file of files) {
    if (isMarkdownFile(file.name)) {
      const textContent = typeof file.content === 'string'
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
        scope,
        title,
        content: textContent,
        folderPath,
        workspaceId,
        projectId,
      });

      importedDocs.push(doc);
    } else {
      if (isTauri()) {
        const targetPath = await joinPath(targetDir, file.name);
        const fs = await import("@tauri-apps/plugin-fs");

        if (typeof file.content === 'string') {
          await fs.writeTextFile(targetPath, file.content);
        } else {
          await fs.writeFile(targetPath, file.content);
        }
        importedAssets.push(file.name);
      }
    }
  }

  return { docs: importedDocs, assets: importedAssets };
}
