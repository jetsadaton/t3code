import { describe, expect, it } from "vite-plus/test";

import { parseCommitGraphLog } from "./commitGraphLog.ts";

const A = "a".repeat(40);
const B = "b".repeat(40);
const C = "c".repeat(40);
const record = (fields: Array<string>) => `${fields.join("\x1f")}\x1e`;

describe("parseCommitGraphLog", () => {
  it("parses parents, decorations and drops a truncated trailing record", () => {
    const stdout =
      record([
        A,
        `${B} ${C}`,
        "Ann",
        "2026-01-02T00:00:00Z",
        "HEAD -> main, origin/main, tag: v1",
        "Merge x",
      ]) +
      "\n" +
      record([B, "", "Bob", "2026-01-01T00:00:00Z", "", "first\x1fwith separator"]) +
      `${C}\x1f`;
    expect(parseCommitGraphLog(stdout, 300)).toEqual([
      {
        sha: A,
        parents: [B, C],
        author: "Ann",
        committedAt: "2026-01-02T00:00:00Z",
        subject: "Merge x",
        refs: ["HEAD -> main", "origin/main", "tag: v1"],
      },
      {
        sha: B,
        parents: [],
        author: "Bob",
        committedAt: "2026-01-01T00:00:00Z",
        subject: "first\x1fwith separator",
        refs: [],
      },
    ]);
  });
});
