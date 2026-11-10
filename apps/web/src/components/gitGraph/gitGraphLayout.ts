import type { ReviewCommitGraphCommit } from "@t3tools/contracts";

export const UNCOMMITTED_SHA = "uncommitted";

/** A line inside one row, between lane columns. Top half ends at the node row, bottom half starts there. */
export interface GraphEdge {
  readonly from: number;
  readonly to: number;
  readonly color: number;
}

export interface GraphRow {
  readonly sha: string;
  readonly column: number;
  readonly color: number;
  readonly top: ReadonlyArray<GraphEdge>;
  readonly bottom: ReadonlyArray<GraphEdge>;
}

export interface GraphLayout {
  readonly rows: ReadonlyArray<GraphRow>;
  readonly columns: number;
}

interface Lane {
  readonly sha: string;
  readonly color: number;
}

/**
 * Assigns each commit a lane column, Git Graph style. Commits must be in an order where children
 * come before parents (`git log --date-order` / `--topo-order`). Lanes keep their column for their
 * whole life so lines never jump sideways; freed slots are reused by the next new branch.
 */
export function layoutCommitGraph(
  commits: ReadonlyArray<Pick<ReviewCommitGraphCommit, "sha" | "parents">>,
): GraphLayout {
  const lanes: Array<Lane | null> = [];
  const rows: Array<GraphRow> = [];
  let nextColor = 0;
  let columns = 0;

  const freeSlot = () => {
    const index = lanes.indexOf(null);
    return index === -1 ? lanes.length : index;
  };

  for (const commit of commits) {
    let column = lanes.findIndex((lane) => lane?.sha === commit.sha);
    // A branch tip has nothing above it, so its lane starts at the node.
    const isTip = column === -1;
    if (isTip) {
      column = freeSlot();
      lanes[column] = { sha: commit.sha, color: nextColor++ };
    }
    const color = lanes[column]!.color;

    const top: Array<GraphEdge> = [];
    lanes.forEach((lane, index) => {
      if (lane === null) return;
      if (lane.sha === commit.sha) {
        if (!(isTip && index === column)) top.push({ from: index, to: column, color: lane.color });
        // Branches that converge on this commit end here.
        if (index !== column) lanes[index] = null;
      } else {
        top.push({ from: index, to: index, color: lane.color });
      }
    });

    const bottom: Array<GraphEdge> = [];
    const [firstParent, ...mergeParents] = commit.parents;
    lanes[column] = firstParent === undefined ? null : { sha: firstParent, color };
    for (const parent of mergeParents) {
      const existing = lanes.findIndex((lane) => lane?.sha === parent);
      if (existing !== -1) {
        bottom.push({
          from: column,
          to: existing,
          color: lanes[existing]!.color,
        });
        continue;
      }
      const slot = freeSlot();
      const lane = { sha: parent, color: nextColor++ };
      lanes[slot] = lane;
      bottom.push({ from: column, to: slot, color: lane.color });
    }
    lanes.forEach((lane, index) => {
      if (lane !== null) bottom.push({ from: index, to: index, color: lane.color });
    });

    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();
    columns = Math.max(columns, column + 1, lanes.length);
    rows.push({ sha: commit.sha, column, color, top, bottom });
  }

  return { rows, columns };
}

export type RefBadge =
  | {
      readonly kind: "branch";
      readonly name: string;
      readonly isHead: boolean;
      readonly remotes: ReadonlyArray<string>;
    }
  | { readonly kind: "remote"; readonly name: string }
  | { readonly kind: "tag"; readonly name: string }
  | { readonly kind: "head" };

/** Turns `git log --decorate=full` `%D` entries into badges, folding `origin/x` into local `x`. */
export function parseRefBadges(refs: ReadonlyArray<string>): Array<RefBadge> {
  const branches: Array<{
    name: string;
    isHead: boolean;
    remotes: Array<string>;
  }> = [];
  const remotes: Array<string> = [];
  const tags: Array<string> = [];
  let detachedHead = false;

  for (const raw of refs) {
    const isHead = raw.startsWith("HEAD -> ");
    const ref = isHead ? raw.slice("HEAD -> ".length) : raw;
    if (ref === "HEAD") detachedHead = true;
    else if (ref.startsWith("tag: "))
      tags.push(ref.slice("tag: ".length).replace(/^refs\/tags\//, ""));
    else if (ref.startsWith("refs/heads/"))
      branches.push({
        name: ref.slice("refs/heads/".length),
        isHead,
        remotes: [],
      });
    else if (ref.startsWith("refs/remotes/") && !ref.endsWith("/HEAD"))
      remotes.push(ref.slice("refs/remotes/".length));
  }

  const unmatchedRemotes = remotes.filter((remote) => {
    const slash = remote.indexOf("/");
    const branch = branches.find((entry) => entry.name === remote.slice(slash + 1));
    if (slash === -1 || !branch) return true;
    branch.remotes.push(remote.slice(0, slash));
    return false;
  });

  return [
    ...(detachedHead ? [{ kind: "head" } as const] : []),
    ...branches.map((branch) => ({ kind: "branch" as const, ...branch })),
    ...unmatchedRemotes.map((name) => ({ kind: "remote" as const, name })),
    ...tags.map((name) => ({ kind: "tag" as const, name })),
  ];
}
