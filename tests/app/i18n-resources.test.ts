import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Resource = Record<string, unknown>;

function load(language: string): Resource {
  return JSON.parse(
    readFileSync(resolve(`packages/app/src/i18n/${language}.json`), "utf8"),
  ) as Resource;
}

function leafKeys(value: Resource, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child)
      ? leafKeys(child as Resource, path)
      : [path];
  });
}

describe("translation resources", () => {
  const englishKeys = new Set(leafKeys(load("en")));

  for (const language of ["de", "fr"]) {
    it(`${language} contains no obsolete or misspelled keys`, () => {
      const unknown = leafKeys(load(language)).filter((key) => !englishKeys.has(key));
      expect(unknown).toEqual([]);
    });
  }
});
