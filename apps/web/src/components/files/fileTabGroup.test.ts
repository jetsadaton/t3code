import { describe, expect, it } from "vite-plus/test";

import type { RightPanelSurface } from "../../rightPanelStore";
import { collapseFileSurfaces } from "./fileTabGroup";

const file = (path: string): RightPanelSurface => ({
  id: `file:${path}`,
  kind: "file",
  relativePath: path,
  revealLine: null,
  revealRequestId: 1,
});

describe("collapseFileSurfaces", () => {
  it("folds files into one tab at the first file's position, keeping the active file's id", () => {
    const surfaces: Array<RightPanelSurface> = [
      { id: "git-graph", kind: "git-graph" },
      file("a.ts"),
      { id: "diff", kind: "diff" },
      file("b.ts"),
    ];
    const { tabs, openFiles } = collapseFileSurfaces(surfaces, "file:a.ts");
    expect(tabs.map((tab) => [tab.id, tab.kind])).toEqual([
      ["git-graph", "git-graph"],
      ["file:a.ts", "files"],
      ["diff", "diff"],
    ]);
    expect(openFiles.map((entry) => entry.id)).toEqual(["file:a.ts", "file:b.ts"]);
    // With another tab active, the folded tab reopens the most recent file.
    expect(collapseFileSurfaces(surfaces, "diff").tabs[1]?.id).toBe("file:b.ts");
  });
});
