import { describe, expect, it } from "vitest";
import { normalizeAgentInstructionsSetting } from "@desk/core";

describe("agent instruction settings", () => {
  it("keeps only global instructions from current and legacy settings", () => {
    expect(normalizeAgentInstructionsSetting({
      global: "Use German",
      perWorkspace: { acme: "legacy workspace instruction" },
    })).toEqual({ global: "Use German" });
    expect(normalizeAgentInstructionsSetting({ global: 123 })).toEqual({ global: "" });
    expect(normalizeAgentInstructionsSetting(null)).toEqual({ global: "" });
  });
});
