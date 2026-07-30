import { describe, expect, it } from "vitest";
import { titleFromFilename } from "../../packages/core/src/desk/file-conversion/title";

describe("imported file titles", () => {
  it("removes only the final extension", () => {
    expect(titleFromFilename("quarterly.report.csv")).toBe("quarterly.report");
    expect(titleFromFilename("README")).toBe("README");
    expect(titleFromFilename(".hidden")).toBe(".hidden");
  });
});
