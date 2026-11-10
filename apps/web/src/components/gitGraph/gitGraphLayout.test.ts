import { describe, expect, it } from "vite-plus/test";

import { layoutCommitGraph, parseRefBadges } from "./gitGraphLayout";

describe("layoutCommitGraph", () => {
  it("branches off, merges back, and reuses freed lanes", () => {
    // M merges F into B; F and B both come from A.
    const layout = layoutCommitGraph([
      { sha: "M", parents: ["B", "F"] },
      { sha: "B", parents: ["A"] },
      { sha: "F", parents: ["A"] },
      { sha: "A", parents: [] },
      { sha: "X", parents: [] },
    ]);
    expect(layout.columns).toBe(2);
    expect(layout.rows.map((row) => [row.sha, row.column])).toEqual([
      ["M", 0],
      ["B", 0],
      ["F", 1],
      ["A", 0],
      ["X", 0],
    ]);
    expect(layout.rows[0]!.top).toEqual([]);
    // The merge draws a line from M into the new lane for F.
    expect(layout.rows[0]!.bottom).toContainEqual({ from: 0, to: 1, color: 1 });
    // F's lane converges into A's column and ends there.
    expect(layout.rows[3]!.top).toContainEqual({ from: 1, to: 0, color: 1 });
    expect(layout.rows[3]!.bottom).toEqual([]);
  });
});

describe("parseRefBadges", () => {
  it("folds matching remotes into local branches and keeps the rest", () => {
    expect(
      parseRefBadges([
        "HEAD -> refs/heads/feat/x",
        "refs/remotes/origin/feat/x",
        "refs/remotes/origin/HEAD",
        "refs/remotes/upstream/main",
        "tag: refs/tags/v1.0",
      ]),
    ).toEqual([
      { kind: "branch", name: "feat/x", isHead: true, remotes: ["origin"] },
      { kind: "remote", name: "upstream/main" },
      { kind: "tag", name: "v1.0" },
    ]);
  });
});
