/**
 * The app's only adapter for direct filesystem access.
 *
 * Most feature code belongs behind DeskService. A few local-owner concerns
 * (editor loading, filesystem watching, and generated agent artifacts) need
 * byte-level access. Keeping that access here makes the exception explicit and
 * lets GuardStorageProvider fail closed when a remote host owns the data.
 */
import { getStorage } from "@desk/core/host";

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
