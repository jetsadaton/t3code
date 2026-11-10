import type { EnvironmentId, ReviewDiffFileStat, ReviewDiffPreviewInput } from "@t3tools/contracts";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useEnvironmentQuery } from "~/state/query";
import { reviewEnvironment } from "~/state/review";

// ponytail: plain patch text, no syntax highlight; "Open in Diff tab" has the full viewer.
const MAX_PATCH_LINES = 2000;

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const dirName = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf("/")));

/** What the expanded row shows: one commit, or the working tree when `sha` is null. */
interface CommitDetailsTarget {
  readonly sha: string | null;
  readonly author: string;
  readonly committedAt: string;
  readonly parents: ReadonlyArray<string>;
}

const sourceInput = (cwd: string, sha: string | null): ReviewDiffPreviewInput =>
  sha === null ? { cwd, sourceKind: "working-tree" } : { cwd, commitSha: sha };

export function CommitDetails(props: {
  environmentId: EnvironmentId;
  cwd: string;
  target: CommitDetailsTarget;
  /** Absent when the Diff tab cannot show this folder. */
  onOpenDiffTab?: (() => void) | undefined;
}) {
  const { target } = props;
  const [openPath, setOpenPath] = useState<string | null>(null);
  const query = useEnvironmentQuery(
    reviewEnvironment.diffPreview({
      environmentId: props.environmentId,
      input: { ...sourceInput(props.cwd, target.sha), metadataOnly: true },
    }),
  );
  const source = query.data?.sources[0];
  const files = source?.files ?? [];
  const additions = files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);

  return (
    <div className="border-y bg-muted/30 px-3 py-2 text-xs">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
        {target.sha ? (
          <>
            <span className="font-mono text-foreground">{target.sha}</span>
            <span>{target.author}</span>
            <span>{new Date(target.committedAt).toLocaleString()}</span>
            {target.parents.length > 0 ? (
              <span>
                Parents:{" "}
                <span className="font-mono">
                  {target.parents.map((parent) => parent.slice(0, 7)).join(", ")}
                </span>
              </span>
            ) : null}
          </>
        ) : (
          <span>Working tree</span>
        )}
        <span>
          {files.length} files <span className="text-success">+{additions}</span>{" "}
          <span className="text-destructive">−{deletions}</span>
        </span>
        <div className="flex-1" />
        {props.onOpenDiffTab ? (
          <Button size="xs" variant="outline" onClick={props.onOpenDiffTab}>
            Open in Diff tab
          </Button>
        ) : null}
      </div>
      {query.error ? <div className="text-destructive">{query.error}</div> : null}
      {query.isPending && files.length === 0 ? (
        <div className="text-muted-foreground">Loading changes…</div>
      ) : null}
      <ul>
        {files.map((file) => (
          <li key={file.path}>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 text-left hover:bg-accent/60"
              onClick={() => setOpenPath(openPath === file.path ? null : file.path)}
            >
              {openPath === file.path ? (
                <ChevronDownIcon className="size-3 shrink-0" />
              ) : (
                <ChevronRightIcon className="size-3 shrink-0" />
              )}
              <span className="shrink-0 font-medium">{baseName(file.path)}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {file.previousPath && file.previousPath !== file.path
                  ? `${file.previousPath} → ${file.path}`
                  : dirName(file.path)}
              </span>
              <span className="shrink-0 text-success">+{file.additions}</span>
              <span className="shrink-0 text-destructive">−{file.deletions}</span>
            </button>
            {openPath === file.path ? (
              <FilePatch
                environmentId={props.environmentId}
                cwd={props.cwd}
                sha={target.sha}
                file={file}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilePatch(props: {
  environmentId: EnvironmentId;
  cwd: string;
  sha: string | null;
  file: ReviewDiffFileStat;
}) {
  const query = useEnvironmentQuery(
    reviewEnvironment.diffPreview({
      environmentId: props.environmentId,
      input: {
        ...sourceInput(props.cwd, props.sha),
        file: {
          path: props.file.path,
          previousPath: props.file.previousPath,
          sourceKind: props.sha === null ? "working-tree" : "commit",
        },
      },
    }),
  );
  if (query.error) return <div className="px-5 py-1 text-destructive">{query.error}</div>;
  const diff = query.data?.sources[0]?.diff;
  if (diff === undefined) return <div className="px-5 py-1 text-muted-foreground">Loading…</div>;
  const lines = diff.split("\n");
  return (
    <pre className="my-1 ml-5 max-h-96 overflow-auto rounded-md border bg-background py-1 font-mono text-2xs leading-4">
      {lines.slice(0, MAX_PATCH_LINES).map((line, index) => (
        <div
          // Patch lines repeat, so position is the only stable key.
          // oxlint-disable-next-line react/no-array-index-key
          key={index}
          className={cn(
            "whitespace-pre px-2",
            line.startsWith("+") && !line.startsWith("+++") && "bg-success/12 text-success",
            line.startsWith("-") && !line.startsWith("---") && "bg-destructive/12 text-destructive",
            line.startsWith("@@") && "text-info",
            (line.startsWith("diff ") ||
              line.startsWith("index ") ||
              line.startsWith("+++") ||
              line.startsWith("---")) &&
              "text-muted-foreground",
          )}
        >
          {line || " "}
        </div>
      ))}
      {lines.length > MAX_PATCH_LINES ? (
        <div className="px-2 text-muted-foreground">
          {lines.length - MAX_PATCH_LINES} more lines. Open the Diff tab to see all.
        </div>
      ) : null}
    </pre>
  );
}
