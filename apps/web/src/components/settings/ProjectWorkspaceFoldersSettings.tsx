import * as Schema from "effect/Schema";
import { XIcon } from "lucide-react";
import { useState } from "react";

import { getLocalStorageItem, setLocalStorageItem } from "../../hooks/useLocalStorage";
import { useProjectGroupUpdate } from "../../hooks/useProjectGroupUpdate";
import { readLocalApi } from "../../localApi";
import type { SidebarProjectGroupMember } from "../../sidebarProjectGrouping";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { SettingsRow, SettingsSection } from "./settingsLayout";

/**
 * Extra folders per checkout, like a VS Code multi-root workspace. Paths belong to the
 * checkout's machine, so each checkout keeps its own list.
 */
export function ProjectWorkspaceFoldersSettings(props: {
  members: ReadonlyArray<SidebarProjectGroupMember>;
  editable: (member: SidebarProjectGroupMember) => boolean;
}) {
  return (
    <SettingsSection title="Workspace folders">
      <p className="px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
        Agents in this project can also read and edit these folders. Claude gets them as additional
        directories; the Files and Git graph panels list them next to the project folder.
      </p>
      {props.members.map((member) => (
        <WorkspaceFoldersRow
          key={member.physicalProjectKey}
          member={member}
          editable={props.editable(member)}
          showEnvironment={props.members.length > 1}
        />
      ))}
    </SettingsSection>
  );
}

function WorkspaceFoldersRow(props: {
  member: SidebarProjectGroupMember;
  editable: boolean;
  showEnvironment: boolean;
}) {
  return (
    <SettingsRow
      title={props.showEnvironment ? (props.member.environmentLabel ?? "Environment") : "Folders"}
      description={props.member.workspaceRoot}
    >
      <div className="pb-2 pt-1">
        <WorkspaceFoldersEditor project={props.member} editable={props.editable} />
      </div>
    </SettingsRow>
  );
}

const LAST_BROWSE_DIRECTORY_KEY = "t3code.workspaceFolderBrowseDirectory";

const parentDirectory = (path: string) => {
  const trimmed = path.replace(/[\\/]+$/, "");
  const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return index > 0 ? trimmed.slice(0, index) : null;
};

function readLastBrowseDirectory(): string | null {
  try {
    return getLocalStorageItem(LAST_BROWSE_DIRECTORY_KEY, Schema.String) ?? null;
  } catch {
    return null;
  }
}

function writeLastBrowseDirectory(path: string) {
  try {
    setLocalStorageItem(LAST_BROWSE_DIRECTORY_KEY, path, Schema.String);
  } catch {
    // Browsing still works; it just opens at the default folder next time.
  }
}

/** Lists a checkout's extra workspace folders with remove buttons and an add field. */
export function WorkspaceFoldersEditor(props: {
  project: Pick<
    SidebarProjectGroupMember,
    "environmentId" | "id" | "environmentLabel" | "additionalDirectories" | "workspaceRoot"
  >;
  editable: boolean;
}) {
  const { project } = props;
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { updateProjectGroup } = useProjectGroupUpdate();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const folders = project.additionalDirectories ?? [];
  // The native picker browses this machine, so it only fits the local environment.
  const canBrowse =
    typeof window !== "undefined" &&
    window.desktopBridge !== undefined &&
    project.environmentId === primaryEnvironmentId;

  const save = async (next: ReadonlyArray<string>, failureTitle: string) => {
    setSaving(true);
    const result = await updateProjectGroup(
      [project],
      { additionalDirectories: [...next] },
      failureTitle,
    );
    setSaving(false);
    return result._tag === "Success";
  };
  const add = async (path: string) => {
    const trimmed = path.trim();
    if (!trimmed || folders.includes(trimmed)) return;
    if (await save([...folders, trimmed], "Failed to add workspace folder")) setDraft("");
  };
  const browse = async () => {
    // Start where the last folder was picked, else beside the project, since sibling repos are typical.
    const initialPath =
      readLastBrowseDirectory() ?? parentDirectory(project.workspaceRoot) ?? undefined;
    const picked = await readLocalApi()?.dialogs.pickFolder(
      initialPath === undefined ? undefined : { initialPath },
    );
    if (!picked) return;
    writeLastBrowseDirectory(parentDirectory(picked) ?? picked);
    await add(picked);
  };

  return (
    <div className="space-y-1.5">
      {folders.map((folder) => (
        <div key={folder} className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 break-all font-mono text-xs">{folder}</span>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Remove ${folder}`}
            disabled={!props.editable || saving}
            onClick={() =>
              void save(
                folders.filter((entry) => entry !== folder),
                "Failed to remove workspace folder",
              )
            }
          >
            <XIcon />
          </Button>
        </div>
      ))}
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void add(draft);
        }}
      >
        <Input
          size="sm"
          className="min-w-0 flex-1"
          placeholder="/absolute/path/to/another/repo"
          aria-label="Folder path"
          value={draft}
          disabled={!props.editable || saving}
          onChange={(event) => setDraft(event.currentTarget.value)}
        />
        <Button size="sm" variant="outline" type="submit" disabled={!props.editable || saving}>
          Add
        </Button>
        {canBrowse ? (
          <Button
            size="sm"
            variant="outline"
            type="button"
            disabled={!props.editable || saving}
            onClick={() => void browse()}
          >
            Browse…
          </Button>
        ) : null}
      </form>
    </div>
  );
}
