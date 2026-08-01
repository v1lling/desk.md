/**
 * Read-only smoke check for a deployed data volume.
 *
 * Run inside the server container, where DESK_DATA_ROOT points at the mounted
 * Markdown tree. It resolves a real project document through the fully scoped
 * DeskService API and confirms that the returned identity and content match the
 * project listing. No file or setting is written.
 */
import { getDeskService } from "@desk/core";
import type { DeskService } from "@desk/core";
import { pathToFileURL } from "node:url";
import { boot } from "../packages/server/src/boot";

type ReadService = Pick<
  DeskService,
  "getWorkspaces" | "getProjects" | "getDocsByProject" | "getDoc"
>;

export interface DeployedReadResult {
  ok: true;
  workspace: string;
  project: string;
  document: string;
}

export async function verifyDeployedRead(service: ReadService): Promise<DeployedReadResult> {
  const workspaces = await service.getWorkspaces();

  for (const workspace of workspaces) {
    const projects = await service.getProjects(workspace.id);

    for (const project of projects) {
      const docs = await service.getDocsByProject(workspace.id, project.id);
      const listed = docs[0];
      if (!listed) continue;

      const resolved = await service.getDoc(workspace.id, project.id, listed.id);
      if (
        !resolved ||
        resolved.workspaceId !== workspace.id ||
        resolved.projectId !== project.id ||
        resolved.filePath !== listed.filePath ||
        resolved.content !== listed.content
      ) {
        throw new Error(
          `Scoped document read mismatch for ${workspace.id}/${project.id}/${listed.id}`,
        );
      }

      return {
        ok: true,
        workspace: workspace.id,
        project: project.id,
        document: listed.id,
      };
    }
  }

  throw new Error("No project document is available for the scoped read smoke check");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  boot();
  console.log(JSON.stringify(await verifyDeployedRead(getDeskService())));
}
