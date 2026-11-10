import type { ReviewCommitGraphCommit } from "@t3tools/contracts";

const COMMIT_GRAPH_FIELD_SEPARATOR = "\x1f";
const COMMIT_GRAPH_RECORD_SEPARATOR = "\x1e";
// sha, parents, author, committer date, decorations, subject.
export const COMMIT_GRAPH_LOG_FORMAT = "%H%x1f%P%x1f%an%x1f%cI%x1f%D%x1f%s%x1e";

const SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

/** Parses `git log --format=COMMIT_GRAPH_LOG_FORMAT`. Drops a truncated trailing record. */
export function parseCommitGraphLog(
  stdout: string,
  subjectLimit: number,
): Array<ReviewCommitGraphCommit> {
  const commits: Array<ReviewCommitGraphCommit> = [];
  const records = stdout.split(COMMIT_GRAPH_RECORD_SEPARATOR);
  // The last element is either "" (clean end) or a partial record cut by the output limit.
  for (const raw of records.slice(0, -1)) {
    const fields = raw.replace(/^\n/, "").split(COMMIT_GRAPH_FIELD_SEPARATOR);
    if (fields.length < 6) continue;
    const [sha = "", parents = "", author = "", committedAt = "", decorations = ""] = fields;
    if (!SHA_PATTERN.test(sha)) continue;
    commits.push({
      sha,
      parents: parents.split(" ").filter((parent) => SHA_PATTERN.test(parent)),
      author,
      committedAt,
      subject: fields.slice(5).join(COMMIT_GRAPH_FIELD_SEPARATOR).slice(0, subjectLimit),
      refs: decorations
        .split(", ")
        .map((ref) => ref.trim())
        .filter((ref) => ref.length > 0),
    });
  }
  return commits;
}
