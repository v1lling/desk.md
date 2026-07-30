import { describe, expect, it } from "vitest";
import { validateDeskRpcEntityMutation } from "../../packages/server/src/desk-rpc-validation";

describe("Desk RPC entity mutation validation", () => {
  it("accepts valid typed entity mutations", () => {
    expect(validateDeskRpcEntityMutation("createTask", [{
      workspaceId: "acme",
      projectId: "website",
      title: "Ship",
      priority: "high",
    }])).toBeNull();
    expect(validateDeskRpcEntityMutation("updateProject", [
      "website",
      { status: "paused", description: null },
      "acme",
    ])).toBeNull();
  });

  it("rejects invalid enums and scalar types before domain dispatch", () => {
    expect(validateDeskRpcEntityMutation("updateTask", [
      "task",
      { status: "blocked" },
    ])).toEqual({
      path: "args[1].status",
      message: "expected one of backlog, todo, doing, waiting, done",
    });
    expect(validateDeskRpcEntityMutation("createWorkspace", [{
      id: "acme",
      name: 42,
    }])).toEqual({
      path: "args[0].name",
      message: "expected string",
    });
  });

  it("leaves unrelated RPC operations untouched", () => {
    expect(validateDeskRpcEntityMutation("getTasks", [42])).toBeNull();
  });
});
