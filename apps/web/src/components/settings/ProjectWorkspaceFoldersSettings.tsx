import { XIcon } from "lucide-react";
import { useState } from "react";

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
  const { member } = props;
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { updateProjectGroup } = useProjectGroupUpdate();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const folders = member.additionalDirectories ?? [];
  // The native picker browses this machine, so it only fits the local environment.
  const canBrowse =
    typeof window !== "undefined" &&
    window.desktopBridge !== undefined &&
    member.environmentId === primaryEnvironmentId;

  const save = async (next: ReadonlyArray<string>, failureTitle: string) => {
    setSaving(true);
    const result = await updateProjectGroup(
      [member],
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
    const picked = await readLocalApi()?.dialogs.pickFolder();
    if (picked) await add(picked);
  };

  return (
    <SettingsRow
      title={props.showEnvironment ? (member.environmentLabel ?? "Environment") : "Folders"}
      description={member.workspaceRoot}
    >
      <div className="space-y-1.5 pb-2 pt-1">
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
    </SettingsRow>
  );
}
