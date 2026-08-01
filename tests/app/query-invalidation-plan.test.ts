import { describe, expect, it } from "vitest";
import {
  planQueryInvalidations,
  type QueryInvalidationTarget,
} from "../../packages/app/src/lib/query-invalidation-plan";

function expectPlan(
  paths: string[],
  expected: QueryInvalidationTarget[],
): void {
  expect(planQueryInvalidations(paths)).toEqual([
    ...expected,
    { type: "file-tree" },
  ]);
}

describe("watcher query invalidation planning", () => {
  it("targets flat and scoped tree queries for project documents", () => {
    expectPlan(
      ["/desk/workspaces/acme/projects/rocket/docs/design.md"],
      [
        { type: "content", workspaceId: "acme" },
        {
          type: "content-tree",
          scope: "workspace",
          workspaceId: "acme",
        },
        {
          type: "content-tree",
          scope: "project",
          workspaceId: "acme",
          projectId: "rocket",
        },
        { type: "dashboard" },
      ],
    );
  });

  it("targets capture, workspace tasks, and task ordering for inbox changes", () => {
    expectPlan(
      ["/desk/workspaces/home/_capture/tasks/new-idea.md"],
      [
        { type: "tasks", workspaceId: "home" },
        { type: "capture" },
        { type: "view-state" },
        { type: "dashboard" },
      ],
    );
  });

  it("deduplicates scopes in a watcher batch", () => {
    expectPlan(
      [
        "/desk/workspaces/acme/projects/rocket/docs/one.md",
        "/desk/workspaces/acme/projects/rocket/docs/two.md",
      ],
      [
        { type: "content", workspaceId: "acme" },
        {
          type: "content-tree",
          scope: "workspace",
          workspaceId: "acme",
        },
        {
          type: "content-tree",
          scope: "project",
          workspaceId: "acme",
          projectId: "rocket",
        },
        { type: "dashboard" },
      ],
    );
  });

  it("falls back to broad workspace invalidation for unknown files", () => {
    expectPlan(
      ["C:\\desk\\workspaces\\acme\\unexpected.json"],
      [
        { type: "tasks", workspaceId: "acme" },
        { type: "content", workspaceId: "acme" },
        { type: "meetings", workspaceId: "acme" },
        { type: "projects", workspaceId: "acme" },
        { type: "dashboard" },
      ],
    );
  });

  it("always refreshes the file tree, even for an empty batch", () => {
    expect(planQueryInvalidations([])).toEqual([{ type: "file-tree" }]);
  });
});
