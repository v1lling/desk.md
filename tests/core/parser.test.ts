import { describe, expect, it } from "vitest";
import {
  compareDatesDesc,
  formatLocalISODate,
  generateFilename,
  normalizeDateTime,
  normalizeOptionalDate,
  resolveContentDate,
  serializeMarkdown,
  slugify,
} from "../../packages/core/src/desk/parser";

describe("Markdown parser helpers", () => {
  it("formats date-only values using the local calendar", () => {
    expect(formatLocalISODate(new Date(2026, 0, 2, 23, 30))).toBe("2026-01-02");
  });

  it("creates stable creation-time filenames", () => {
    expect(generateFilename("  Client Launch!  ", new Date(2026, 6, 29))).toBe(
      "2026-07-29-client-launch.md",
    );
    expect(slugify("One   two---three")).toBe("one-two-three");
  });

  it("resolves content dates without fabricating an unknown date", () => {
    expect(resolveContentDate(undefined, "2026-07-29-notes.md")).toBe("2026-07-29");
    expect(resolveContentDate(undefined, "notes.md")).toBeUndefined();
    expect(resolveContentDate(undefined, "2026-02-30-invalid.md")).toBeUndefined();
  });

  it("normalizes valid date and datetime values and rejects garbage", () => {
    expect(normalizeOptionalDate("2026-07-29")).toBe("2026-07-29");
    expect(normalizeOptionalDate("not-a-date")).toBeUndefined();
    expect(normalizeDateTime("2026-07-29T12:30:00.000Z")).toBe(
      "2026-07-29T12:30:00.000Z",
    );
    expect(normalizeDateTime("not-a-date")).toBeUndefined();
  });

  it("sorts unknown dates after known dates", () => {
    expect(["2026-01-01", undefined, "2026-03-01"].sort(compareDatesDesc)).toEqual([
      "2026-03-01",
      "2026-01-01",
      undefined,
    ]);
  });

  it("rejects invalid frontmatter containers", () => {
    expect(() => serializeMarkdown(null, "")).toThrow(/invalid data type/);
    expect(() => serializeMarkdown([], "")).toThrow(/invalid data type/);
  });
});
