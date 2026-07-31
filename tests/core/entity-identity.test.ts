import { describe, expect, it } from "vitest";
import {
  createNoteLinkHref,
  findByTypeAndId,
  getScopedEntityKey,
  isSameEntity,
  parseNoteLinkHref,
  rebuildIndex,
} from "@desk/core";
import { getEntityTabId } from "../../packages/app/src/lib/tab-identity";

const crm = {
  id: "Context/2026-07-16-state",
  workspaceId: "slsp",
  projectId: "crm-project",
};
const library = {
  ...crm,
  projectId: "storage-library-interface",
};

describe("scoped entity identity", () => {
  it("keeps equal file IDs distinct across projects", () => {
    expect(getScopedEntityKey(crm)).not.toBe(getScopedEntityKey(library));
    expect(getEntityTabId("doc", crm)).not.toBe(getEntityTabId("doc", library));
    expect(isSameEntity(crm, library)).toBe(false);
  });

  it("round-trips scoped note links while retaining legacy parsing", () => {
    const href = createNoteLinkHref(
      "doc",
      library.id,
      library.workspaceId,
      library.projectId,
    );
    expect(parseNoteLinkHref(href)).toEqual({ type: "doc", ...library });
    expect(parseNoteLinkHref("desk://doc/2026-07-16-state")).toEqual({
      type: "doc",
      id: "2026-07-16-state",
    });
    expect(parseNoteLinkHref("desk://doc/Context/archive/current-state")).toEqual({
      type: "doc",
      id: "Context/archive/current-state",
    });
  });

  it("does not resolve an ambiguous legacy search identity", () => {
    rebuildIndex([
      {
        ...crm,
        type: "doc",
        title: "Current state",
        content: "CRM",
      },
      {
        ...library,
        type: "doc",
        title: "Current state",
        content: "Library",
      },
    ]);

    expect(findByTypeAndId("doc", crm.id)).toBeNull();
    expect(findByTypeAndId("doc", library.id, library)).toMatchObject(library);
  });
});
