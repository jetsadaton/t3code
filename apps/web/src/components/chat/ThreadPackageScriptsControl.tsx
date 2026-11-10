import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ProjectId, ProjectScript } from "@t3tools/contracts";
import { ChevronDownIcon, PlayIcon } from "lucide-react";
import { useRef } from "react";

import { useProject } from "~/state/entities";

import { useProjectFileQuery } from "../files/projectFilesQueryState";
import { Menu, MenuItem, MenuItemLabel, MenuPopup, MenuTrigger } from "../ui/menu";
import { ThreadDetailsControl } from "./ThreadDetailsControl";
import {
  THREAD_DETAILS_PANEL_CHEVRON_CLASS,
  THREAD_DETAILS_PANEL_ICON_CLASS,
  THREAD_DETAILS_PANEL_LABEL_CLASS,
  THREAD_DETAILS_PANEL_SPLIT_GROUP_CLASS,
  THREAD_DETAILS_PANEL_SPLIT_SEPARATOR_CLASS,
} from "./threadDetailsPanelStyles";

export type RunPackageScript = (
  script: ProjectScript,
  options?: { cwd: string; preferNewTerminal: boolean; rememberAsLastInvoked: boolean },
) => void;

const PRIMARY_SCRIPT_NAMES = ["dev", "start", "serve"];

/** Scripts from a package.json, run with the manager it pins (`packageManager`), else npm. */
export function parsePackageScripts(
  contents: string,
): { runner: string; names: ReadonlyArray<string> } | null {
  try {
    const json: unknown = JSON.parse(contents);
    if (typeof json !== "object" || json === null) return null;
    const { scripts, packageManager } = json as Record<string, unknown>;
    if (typeof scripts !== "object" || scripts === null) return null;
    const names = Object.entries(scripts)
      .filter(([, command]) => typeof command === "string")
      .map(([name]) => name);
    if (names.length === 0) return null;
    const pinned = typeof packageManager === "string" ? packageManager.split("@")[0] : "";
    const runner = pinned === "pnpm" || pinned === "yarn" || pinned === "bun" ? pinned : "npm";
    return { runner, names };
  } catch {
    return null;
  }
}

const folderName = (path: string) => path.slice(path.lastIndexOf("/") + 1) || path;

/** One "▷ run dev" row per workspace folder that has package.json scripts. */
export function ThreadPackageScriptsControl(props: {
  environmentId: EnvironmentId;
  projectId: ProjectId;
  rootCwd: string;
  onRun: RunPackageScript;
}) {
  const project = useProject(scopeProjectRef(props.environmentId, props.projectId));
  const folders = [props.rootCwd, ...(project?.additionalDirectories ?? [])];
  return folders.map((cwd) => (
    <FolderPackageScripts
      key={cwd}
      environmentId={props.environmentId}
      cwd={cwd}
      showFolder={folders.length > 1}
      onRun={props.onRun}
    />
  ));
}

function FolderPackageScripts(props: {
  environmentId: EnvironmentId;
  cwd: string;
  showFolder: boolean;
  onRun: RunPackageScript;
}) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const query = useProjectFileQuery(props.environmentId, props.cwd, "package.json");
  const contents = query.data && !query.data.truncated ? query.data.contents : null;
  const parsed = contents === null ? null : parsePackageScripts(contents);
  if (parsed === null) return null;
  const primary =
    PRIMARY_SCRIPT_NAMES.find((name) => parsed.names.includes(name)) ?? parsed.names[0]!;
  const run = (name: string) =>
    props.onRun(
      {
        id: `package-json:${props.cwd}:${name}`,
        name,
        command: `${parsed.runner} run ${name}`,
        icon: "play",
        runOnWorktreeCreate: false,
      },
      { cwd: props.cwd, preferNewTerminal: true, rememberAsLastInvoked: false },
    );
  const folder = props.showFolder ? folderName(props.cwd) : null;
  return (
    <div
      role="group"
      aria-label={`package.json scripts${folder ? ` in ${folder}` : ""}`}
      className={THREAD_DETAILS_PANEL_SPLIT_GROUP_CLASS}
      ref={anchorRef}
    >
      <ThreadDetailsControl size="sm" variant="ghost" part="primary" onClick={() => run(primary)}>
        <PlayIcon className={THREAD_DETAILS_PANEL_ICON_CLASS} />
        <span className={`min-w-0 truncate ${THREAD_DETAILS_PANEL_LABEL_CLASS}`}>
          run {primary}
        </span>
        {folder ? (
          <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">
            {folder}
          </span>
        ) : null}
      </ThreadDetailsControl>
      <span aria-hidden="true" className={THREAD_DETAILS_PANEL_SPLIT_SEPARATOR_CLASS} />
      <Menu>
        <MenuTrigger
          render={
            <ThreadDetailsControl
              size="sm"
              variant="ghost"
              part="secondary"
              aria-label="Choose package.json script"
            />
          }
        >
          <ChevronDownIcon className={THREAD_DETAILS_PANEL_CHEVRON_CLASS} />
        </MenuTrigger>
        <MenuPopup align="end" anchor={anchorRef} className="max-h-80 w-(--anchor-width)">
          {parsed.names.map((name) => (
            <MenuItem key={name} onClick={() => run(name)}>
              <PlayIcon className="size-4" />
              <MenuItemLabel>
                {parsed.runner} run {name}
              </MenuItemLabel>
            </MenuItem>
          ))}
        </MenuPopup>
      </Menu>
    </div>
  );
}
