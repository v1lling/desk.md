import { describe, expect, it } from "vitest";
import { getScopedEntityKey, PROJECT_TREE_PATH_PREFIX } from "@desk/core";
import type { Doc, FileTreeNode } from "@desk/core/types";
import {
  canDropInto,
  nodesToArborist,
  type ArboristNode,
} from "../../packages/app/src/components/docs/tree/arborist-adapter";
import {
  buildDocMoveTargets,
  composeWorkspaceTree,
  findSelectedArboristId,
  getActivatedDoc,
  planTreeMove,
  prefixProjectPaths,
} from "../../packages/app/src/components/docs/tree/docs-tree-model";

const workspaceId = "slsp";

function makeDoc(projectId: string, content: string): Doc {
  return {
    id: "Context/2026-07-16-state",
    path: "Context/2026-07-16-state.md",
    projectId,
    workspaceId,
    filePath: `/desk/${workspaceId}/projects/${projectId}/docs/Context/2026-07-16-state.md`,
    title: "Current state",
    content,
  };
}

function projectStub(projectId: string, name: string): FileTreeNode {
  return {
    type: "folder",
    folder: {
      name,
      path: `${PROJECT_TREE_PATH_PREFIX}${projectId}`,
      projectId,
      isProject: true,
      children: [],
    },
  };
}

function projectTree(doc: Doc): FileTreeNode[] {
  return [{
    type: "folder",
    folder: {
      name: "Context",
      path: "Context",
      children: [{ type: "doc", doc }],
    },
  }];
}

function findNode(nodes: ArboristNode[], id: string): ArboristNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = node.children ? findNode(node.children, id) : undefined;
    if (child) return child;
  }
  return undefined;
}

describe("document tree identity", () => {
  it("opens the correct same-named document from its owning project", () => {
    const crmDoc = makeDoc("crm-project", "CRM project state");
    const libraryDoc = makeDoc("storage-library-interface", "Library interface state");
    const overview = [
      projectStub(crmDoc.projectId, "CRM Project"),
      projectStub(libraryDoc.projectId, "Speicherbibliothek Interface"),
    ];
    const subtrees = new Map([
      [crmDoc.projectId, prefixProjectPaths(projectTree(crmDoc), crmDoc.projectId)],
      [libraryDoc.projectId, prefixProjectPaths(projectTree(libraryDoc), libraryDoc.projectId)],
    ]);
    const tree = nodesToArborist(composeWorkspaceTree(overview, subtrees));

    const selectedId = findSelectedArboristId(getScopedEntityKey(libraryDoc), tree);
    const activatedDoc = selectedId ? getActivatedDoc(findNode(tree, selectedId)!) : undefined;

    expect(selectedId).toBe(
      "doc|_project/storage-library-interface/Context/2026-07-16-state",
    );
    expect(activatedDoc).toBe(libraryDoc);
    expect(activatedDoc?.content).toBe("Library interface state");
    expect(activatedDoc).not.toBe(crmDoc);
  });
});

describe("document tree move decisions", () => {
  it("plans a document move across projects with both scoped locations", () => {
    const doc = makeDoc("crm-project", "CRM project state");
    const [node] = nodesToArborist(
      [{ type: "doc", doc }],
      "_project/crm-project/Context",
    );

    expect(planTreeMove(node, "_project/storage-library-interface/Archive")).toEqual({
      kind: "doc",
      docId: doc.id,
      from: {
        scope: "project",
        projectId: "crm-project",
        folderPath: "Context",
      },
      to: {
        scope: "project",
        projectId: "storage-library-interface",
        folderPath: "Archive",
      },
    });
  });

  it("allows folder moves only inside the same scope and project", () => {
    const [folder] = nodesToArborist(prefixProjectPaths([{
      type: "folder",
      folder: { name: "Context", path: "Context", children: [] },
    }], "crm-project"));

    expect(planTreeMove(folder, "_project/crm-project/Archive")).toEqual({
      kind: "folder",
      scope: "project",
      projectId: "crm-project",
      fromPath: "Context",
      toParentPath: "Archive",
    });
    expect(planTreeMove(folder, "_project/storage-library-interface")).toEqual({
      kind: "blocked-folder-cross-scope",
    });
  });

  it("rejects drops onto leaves and into a folder's own descendant", () => {
    const doc = nodesToArborist([{ type: "doc", doc: makeDoc("crm-project", "CRM") }])[0];
    const [folder] = nodesToArborist([{
      type: "folder",
      folder: {
        name: "Context",
        path: "Context",
        children: [{
          type: "folder",
          folder: { name: "Archive", path: "Context/Archive", children: [] },
        }],
      },
    }]);

    expect(canDropInto(doc, [folder])).toBe(false);
    expect(canDropInto(folder.children![0], [folder])).toBe(false);
  });

  it("does not offer the document's current scoped container as a move target", () => {
    const targets = buildDocMoveTargets({
      parentTreePath: "_project/crm-project",
      workspaceFolderPaths: ["Context"],
      projects: [
        { id: "crm-project", name: "CRM Project" },
        { id: "storage-library-interface", name: "Speicherbibliothek Interface" },
      ],
      workspaceLabel: "Workspace",
    });

    expect(targets).toEqual([
      { label: "Workspace", toTreePath: "" },
      { label: "Context", toTreePath: "Context" },
      {
        label: "Speicherbibliothek Interface",
        isProject: true,
        toTreePath: "_project/storage-library-interface",
      },
    ]);
  });
});
