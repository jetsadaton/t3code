import type { EnvironmentId, ReviewCommitGraphCommit, ScopedThreadRef } from "@t3tools/contracts";
import { TagIcon } from "lucide-react";
import { Fragment, useState } from "react";

import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { WorkspaceRootPicker } from "~/components/files/WorkspaceRootPicker";
import { useDiffPanelStore } from "~/diffPanelStore";
import { useRightPanelStore } from "~/rightPanelStore";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { RefreshIcon } from "~/components/ui/refresh-icon";
import { cn } from "~/lib/utils";
import { useEnvironmentQuery } from "~/state/query";
import { reviewEnvironment } from "~/state/review";
import { revisionedQuery } from "~/state/revisionedQuery";

import {
  type GraphEdge,
  type GraphRow,
  layoutCommitGraph,
  parseRefBadges,
  type RefBadge,
  UNCOMMITTED_SHA,
} from "./gitGraphLayout";
import { CommitDetails } from "./CommitDetails";

const ROW_HEIGHT = 24;
const LANE_WIDTH = 14;
// ponytail: lanes past this are clipped; add a draggable column if wide graphs need reading.
const MAX_GRAPH_WIDTH = 10 * LANE_WIDTH;
const NODE_RADIUS = 4;
// ponytail: fixed palette close to VS Code Git Graph; move to theme tokens if it needs theming.
const LANE_COLORS = [
  "#0085d9",
  "#d9008f",
  "#00d90a",
  "#d98500",
  "#a300d9",
  "#ff0000",
  "#00d9cc",
  "#e138e8",
  "#85d900",
  "#dc5b23",
];
const laneColor = (index: number) => LANE_COLORS[index % LANE_COLORS.length]!;
const laneX = (column: number) => LANE_WIDTH / 2 + column * LANE_WIDTH;

function edgePath(edge: GraphEdge, y1: number, y2: number) {
  const x1 = laneX(edge.from);
  const x2 = laneX(edge.to);
  if (x1 === x2) return `M${x1},${y1}L${x2},${y2}`;
  const mid = (y1 + y2) / 2;
  return `M${x1},${y1}C${x1},${mid} ${x2},${mid} ${x2},${y2}`;
}

function GraphCell(props: { row: GraphRow; width: number; hollow: boolean }) {
  const { row, width } = props;
  const mid = ROW_HEIGHT / 2;
  const color = laneColor(row.color);
  return (
    <svg width={width} height={ROW_HEIGHT} className="shrink-0" aria-hidden>
      {row.top.map((edge) => (
        <path
          key={`t${edge.from}-${edge.to}`}
          d={edgePath(edge, 0, mid)}
          stroke={laneColor(edge.color)}
          strokeWidth={2}
          fill="none"
        />
      ))}
      {row.bottom.map((edge) => (
        <path
          key={`b${edge.from}-${edge.to}`}
          d={edgePath(edge, mid, ROW_HEIGHT)}
          stroke={laneColor(edge.color)}
          strokeWidth={2}
          fill="none"
        />
      ))}
      <circle
        cx={laneX(row.column)}
        cy={mid}
        r={NODE_RADIUS}
        fill={props.hollow ? "var(--background)" : color}
        stroke={color}
        strokeWidth={props.hollow ? 2 : 0}
      />
    </svg>
  );
}

function RefBadgeView(props: { badge: RefBadge; color: string }) {
  const { badge } = props;
  const label = badge.kind === "head" ? "HEAD" : badge.name;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center overflow-hidden rounded-sm border text-2xs leading-4",
        badge.kind === "branch" && badge.isHead && "font-semibold",
      )}
      style={{ borderColor: props.color }}
    >
      {badge.kind === "tag" ? <TagIcon className="ml-1 size-3" /> : null}
      <span
        className="px-1"
        style={badge.kind === "branch" ? { background: props.color, color: "white" } : undefined}
      >
        {label}
      </span>
      {badge.kind === "branch"
        ? badge.remotes.map((remote) => (
            <span
              key={remote}
              className="border-l px-1 italic opacity-80"
              style={{ borderColor: props.color }}
            >
              {remote}
            </span>
          ))
        : null}
    </span>
  );
}

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString();
};

export function GitGraphPanel(props: {
  environmentId: EnvironmentId;
  /** Project folder first, then extra workspace folders. */
  roots: ReadonlyArray<string>;
  workspaceMutationId: string | null;
  threadRef: ScopedThreadRef;
}) {
  const [includeRemotes, setIncludeRemotes] = useState(true);
  const [expandedSha, setExpandedSha] = useState<string | null>(null);
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
  const cwd =
    selectedRoot !== null && props.roots.includes(selectedRoot) ? selectedRoot : props.roots[0]!;
  const query = useEnvironmentQuery(
    revisionedQuery(
      reviewEnvironment.commitGraph({
        environmentId: props.environmentId,
        input: { cwd, includeRemotes },
      }),
      props.workspaceMutationId ?? undefined,
    ),
  );
  const data = query.data;
  const openDiffTab = (sha: string | null) => {
    if (sha === null) {
      useDiffPanelStore.getState().selectGitScope(props.threadRef, "unstaged");
      useDiffPanelStore.setState({
        keepSelectionOnOpenThreadKey: scopedThreadKey(props.threadRef),
      });
    }
    // keepOnOpen: opening a closed Diff tab otherwise resets to the branch view.
    else useDiffPanelStore.getState().selectCommit(props.threadRef, sha, true);
    useRightPanelStore.getState().open(props.threadRef, "diff");
  };

  const { commits, layout } = (() => {
    const list: Array<ReviewCommitGraphCommit> = [...(data?.commits ?? [])];
    if (data && data.uncommittedCount > 0 && data.headSha) {
      list.unshift({
        sha: UNCOMMITTED_SHA,
        parents: [data.headSha],
        author: "",
        committedAt: "",
        subject: `Uncommitted changes (${data.uncommittedCount})`,
        refs: [],
      });
    }
    return { commits: list, layout: layoutCommitGraph(list) };
  })();
  const graphWidth = Math.max(1, layout.columns) * LANE_WIDTH;

  return (
    <div className="flex min-h-0 flex-1 flex-col text-xs">
      {props.roots.length > 1 ? (
        <WorkspaceRootPicker roots={props.roots} value={cwd} onChange={setSelectedRoot} />
      ) : null}
      <div className="flex items-center gap-3 border-b px-3 py-1.5">
        <label className="flex items-center gap-1.5">
          <Checkbox
            checked={includeRemotes}
            onCheckedChange={(checked) => setIncludeRemotes(checked === true)}
          />
          Show remote branches
        </label>
        <div className="flex-1" />
        {data?.truncated ? (
          <span className="text-muted-foreground">Showing latest {data.commits.length}</span>
        ) : null}
        <Button size="icon-xs" variant="ghost" aria-label="Refresh" onClick={query.refresh}>
          <RefreshIcon size="sm" refreshing={query.isPending} />
        </Button>
      </div>
      {query.error ? (
        <div className="p-3 text-destructive">{query.error}</div>
      ) : (
        <div className="@container min-h-0 flex-1 overflow-auto">
          {commits.map((commit, index) => {
            const row = layout.rows[index]!;
            const uncommitted = commit.sha === UNCOMMITTED_SHA;
            const isHead = commit.sha === data?.headSha;
            const color = laneColor(row.color);
            const badges = parseRefBadges(commit.refs);
            const expanded = expandedSha === commit.sha;
            return (
              <Fragment key={commit.sha}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedSha(expanded ? null : commit.sha)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 pr-3 text-left hover:bg-accent/50 [content-visibility:auto] [contain-intrinsic-size:auto_24px]",
                    expanded && "bg-accent/60",
                  )}
                  style={{ height: ROW_HEIGHT }}
                >
                  <div
                    className="shrink-0 overflow-hidden"
                    style={{ width: Math.min(graphWidth, MAX_GRAPH_WIDTH) }}
                  >
                    <GraphCell row={row} width={graphWidth} hollow={uncommitted || isHead} />
                  </div>
                  {badges.length > 0 ? (
                    <div className="flex min-w-0 max-w-1/2 shrink items-center gap-1 overflow-hidden">
                      {badges.map((badge) => (
                        <RefBadgeView
                          key={`${badge.kind}:${"name" in badge ? badge.name : ""}`}
                          badge={badge}
                          color={color}
                        />
                      ))}
                    </div>
                  ) : null}
                  <span
                    className={cn(
                      "min-w-16 flex-1 truncate",
                      uncommitted && "font-semibold",
                      commit.parents.length > 1 && "text-muted-foreground",
                    )}
                  >
                    {commit.subject}
                  </span>
                  {uncommitted ? null : (
                    <>
                      <span className="hidden max-w-24 shrink-0 truncate text-muted-foreground @2xl:block">
                        {commit.author}
                      </span>
                      <span className="hidden shrink-0 text-muted-foreground @xl:block">
                        {formatDate(commit.committedAt)}
                      </span>
                      <span className="shrink-0 font-mono text-muted-foreground">
                        {commit.sha.slice(0, 7)}
                      </span>
                    </>
                  )}
                </button>
                {expanded ? (
                  <div
                    className="relative"
                    style={{ paddingLeft: Math.min(graphWidth, MAX_GRAPH_WIDTH) }}
                  >
                    {/* Lanes keep running past the details so the graph stays readable. */}
                    {row.bottom
                      .filter((edge) => edge.from === edge.to && laneX(edge.to) < MAX_GRAPH_WIDTH)
                      .map((edge) => (
                        <span
                          key={edge.to}
                          aria-hidden
                          className="absolute inset-y-0 w-0.5"
                          style={{ left: laneX(edge.to) - 1, background: laneColor(edge.color) }}
                        />
                      ))}
                    <CommitDetails
                      environmentId={props.environmentId}
                      cwd={cwd}
                      target={{
                        sha: uncommitted ? null : commit.sha,
                        author: commit.author,
                        committedAt: commit.committedAt,
                        parents: commit.parents,
                      }}
                      onOpenDiffTab={
                        cwd === props.roots[0]
                          ? () => openDiffTab(uncommitted ? null : commit.sha)
                          : undefined
                      }
                    />
                  </div>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
