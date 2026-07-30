import { describe, expect, it } from "vitest";
import type { BuildIndexResult, WorkspaceIndex } from "../../packages/core/src";
import type { Workspace } from "../../packages/core/src/types";
import {
  deriveSmartIndexOverview,
  mergeBuildIndexResults,
} from "../../packages/app/src/lib/smart-index/model";

function workspaceIndex(
  workspaceId: string,
  workspaceName: string,
  summaries: Array<string | undefined>,
  timestamps: { builtAt: string; updatedAt?: string },
): WorkspaceIndex {
  return {
    workspaceId,
    workspaceName,
    builtAt: timestamps.builtAt,
    updatedAt: timestamps.updatedAt,
    fileCount: summaries.length,
    entries: summaries.map((summary, index) => ({
      path: `docs/${index}.md`,
      type: "doc",
      title: `Document ${index}`,
      summary,
    })),
  };
}

describe("Smart Index view model", () => {
  it("derives coverage and sorted workspace rows", () => {
    const indexes = {
      zeta: workspaceIndex("zeta", "Zeta", ["Summary", undefined], {
        builtAt: "2026-07-01T10:00:00.000Z",
      }),
      alpha: workspaceIndex("alpha", "Alpha", ["Summary"], {
        builtAt: "2026-07-02T10:00:00.000Z",
        updatedAt: "2026-07-03T10:00:00.000Z",
      }),
    };
    const workspaces: Workspace[] = [
      {
        id: "alpha",
        name: "Alpha",
        created: "2026-01-01",
        color: "#123456",
      },
    ];

    expect(deriveSmartIndexOverview(indexes, workspaces)).toEqual({
      totalIndexFiles: 3,
      summarizedCount: 2,
      pendingCount: 1,
      workspaceRows: [
        {
          id: "alpha",
          name: "Alpha",
          fileCount: 1,
          updatedAt: "2026-07-03T10:00:00.000Z",
          color: "#123456",
        },
        {
          id: "zeta",
          name: "Zeta",
          fileCount: 2,
          updatedAt: "2026-07-01T10:00:00.000Z",
          color: "#6366f1",
        },
      ],
    });
  });

  it("aggregates rebuild counts and errors without mutating either result", () => {
    const current: BuildIndexResult = {
      totalFiles: 2,
      summarized: 1,
      reused: 1,
      excluded: 0,
      errors: ["first"],
    };
    const next: BuildIndexResult = {
      totalFiles: 4,
      summarized: 2,
      reused: 1,
      excluded: 1,
      errors: ["second"],
    };

    expect(mergeBuildIndexResults(current, next)).toEqual({
      totalFiles: 6,
      summarized: 3,
      reused: 2,
      excluded: 1,
      errors: ["first", "second"],
    });
    expect(current.errors).toEqual(["first"]);
    expect(next.errors).toEqual(["second"]);
  });
});
