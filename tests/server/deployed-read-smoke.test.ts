import { describe, expect, it, vi } from "vitest";
import type { Doc, Project, Workspace } from "@desk/core/types";
import { verifyDeployedRead } from "../../scripts/verify-deployed-read";

const workspace: Workspace = {
  id: "slsp",
  name: "SLSP",
  created: "2026-01-01",
};

const project: Project = {
  id: "library-interface",
  workspaceId: workspace.id,
  name: "Speicherbibliothek Interface",
  status: "active",
  created: "2026-01-01",
};

const listedDoc: Doc = {
  id: "2026-07-16-state",
  workspaceId: workspace.id,
  projectId: project.id,
  filePath: "/data/workspaces/slsp/projects/library-interface/docs/2026-07-16-state.md",
  title: "Current state",
  content: "Library interface state",
};

describe("deployed scoped-read smoke", () => {
  it("reads the listed document with its complete workspace/project identity", async () => {
    const getDoc = vi.fn().mockResolvedValue(listedDoc);
    const result = await verifyDeployedRead({
      getWorkspaces: vi.fn().mockResolvedValue([workspace]),
      getProjects: vi.fn().mockResolvedValue([project]),
      getDocsByProject: vi.fn().mockResolvedValue([listedDoc]),
      getDoc,
    });

    expect(getDoc).toHaveBeenCalledWith(workspace.id, project.id, listedDoc.id);
    expect(result).toEqual({
      ok: true,
      workspace: workspace.id,
      project: project.id,
      document: listedDoc.id,
    });
  });

  it("rejects a same-id document resolved from another project", async () => {
    await expect(
      verifyDeployedRead({
        getWorkspaces: vi.fn().mockResolvedValue([workspace]),
        getProjects: vi.fn().mockResolvedValue([project]),
        getDocsByProject: vi.fn().mockResolvedValue([listedDoc]),
        getDoc: vi.fn().mockResolvedValue({
          ...listedDoc,
          projectId: "crm",
          filePath: "/data/workspaces/slsp/projects/crm/docs/2026-07-16-state.md",
          content: "CRM state",
        }),
      }),
    ).rejects.toThrow("Scoped document read mismatch");
  });
});
