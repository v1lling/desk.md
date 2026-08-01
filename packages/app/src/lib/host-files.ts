/**
 * The app's only adapter for direct filesystem access.
 *
 * Most feature code belongs behind DeskService. A few local-owner concerns
 * (editor loading, filesystem watching, and generated agent artifacts) need
 * byte-level access. Keeping that access here makes the exception explicit and
 * lets GuardStorageProvider fail closed when a remote host owns the data.
 */
import {
  expandFsScope,
  getContentCache,
  getFileTreeService,
  getStorage,
  initDeskDirectory,
  saveMarkdownBody,
  writeMarkdownFile,
} from "@desk/core/host/files";

export async function hostFileExists(path: string): Promise<boolean> {
  return getStorage().exists(path);
}

export async function readHostTextFile(path: string): Promise<string> {
  return getStorage().readTextFile(path);
}

export async function writeHostTextFile(path: string, content: string): Promise<void> {
  await getStorage().writeTextFile(path, content);
}

export async function removeHostFile(path: string): Promise<void> {
  await getStorage().removeFile(path);
}

export async function expandHostFsScope(dataPath?: string): Promise<void> {
  await expandFsScope(dataPath);
}

export async function initializeHostDeskDirectory(): Promise<void> {
  await initDeskDirectory();
}

export function saveHostMarkdownBody(path: string, content: string) {
  return saveMarkdownBody(path, content);
}

export function writeHostMarkdownFile(
  path: string,
  frontmatter: Record<string, unknown>,
  content: string,
) {
  return writeMarkdownFile(path, frontmatter, content);
}

export function getHostContentCache() {
  return getContentCache();
}

export function getHostFileTreeService() {
  return getFileTreeService();
}
