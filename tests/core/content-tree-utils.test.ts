import { describe, expect, it } from "vitest";
import type { Asset, Doc, FileTreeNode } from "../../packages/core/src/types";
import {
  extractAssets,
  extractDocs,
  extractFolderPaths,
  getNodeKey,
} from "../../packages/core/src/desk/content-tree-utils";

function doc(id: string, path: string): Doc {
  return {
    id,
    path,
    projectId: "project",
    workspaceId: "workspace",
    filePath: `/desk/${path}`,
    title: id,
    content: "",
  };
}

function asset(path: string): Asset {
  return {
    id: path.split("/").at(-1) ?? path,
    path,
    projectId: "project",
    workspaceId: "workspace",
    filePath: `/desk/${path}`,
    extension: "png",
  };
}

const rootDoc = doc("root", "root.md");
const nestedDoc = doc("notes/nested", "notes/nested.md");
const deepDoc = doc("notes/archive/deep", "notes/archive/deep.md");
const nestedAsset = asset("notes/diagram.png");

const tree: FileTreeNode[] = [
  { type: "doc", doc: rootDoc },
  {
    type: "folder",
    folder: {
      name: "notes",
      path: "notes",
      children: [
        { type: "doc", doc: nestedDoc },
        { type: "asset", asset: nestedAsset },
        {
          type: "folder",
          folder: {
            name: "archive",
            path: "notes/archive",
            children: [{ type: "doc", doc: deepDoc }],
          },
        },
      ],
    },
  },
];

describe("content tree traversal", () => {
  it("extracts each content kind in depth-first display order", () => {
    expect(extractDocs(tree)).toEqual([rootDoc, nestedDoc, deepDoc]);
    expect(extractAssets(tree)).toEqual([nestedAsset]);
    expect(extractFolderPaths(tree)).toEqual(["notes", "notes/archive"]);
  });

  it("does not mutate the source tree", () => {
    const snapshot = structuredClone(tree);

    extractDocs(tree);
    extractAssets(tree);
    extractFolderPaths(tree);

    expect(tree).toEqual(snapshot);
  });

  it("uses paths where basenames alone would collide", () => {
    expect(getNodeKey(tree[0])).toBe("doc-root");
    expect(getNodeKey(tree[1])).toBe("folder-notes");
    expect(
      getNodeKey({ type: "asset", asset: asset("archive/diagram.png") }),
    ).toBe("asset-archive/diagram.png");
  });
});
