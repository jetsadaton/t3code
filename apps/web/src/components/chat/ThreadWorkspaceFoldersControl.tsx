import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import {
  AuthOrchestrationOperateScope,
  type EnvironmentId,
  type ProjectId,
} from "@t3tools/contracts";
import { FolderPlusIcon } from "lucide-react";

import { useProject } from "~/state/entities";
import { useEnvironmentScope } from "~/state/session";

import { WorkspaceFoldersEditor } from "../settings/ProjectWorkspaceFoldersSettings";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "../ui/popover";
import { ThreadDetailsControl } from "./ThreadDetailsControl";
import {
  THREAD_DETAILS_PANEL_ICON_CLASS,
  THREAD_DETAILS_PANEL_LABEL_CLASS,
} from "./threadDetailsPanelStyles";

/** Shows and edits the project's extra workspace folders from the thread's Workspace card. */
export function ThreadWorkspaceFoldersControl(props: {
  environmentId: EnvironmentId;
  projectId: ProjectId;
}) {
  const project = useProject(scopeProjectRef(props.environmentId, props.projectId));
  const editable = useEnvironmentScope(props.environmentId, AuthOrchestrationOperateScope);
  if (project === null) return null;
  const count = project.additionalDirectories?.length ?? 0;
  return (
    <Popover>
      <PopoverTrigger render={<ThreadDetailsControl />}>
        <FolderPlusIcon className={THREAD_DETAILS_PANEL_ICON_CLASS} />
        <span className={THREAD_DETAILS_PANEL_LABEL_CLASS}>
          {count === 0 ? "Add workspace folder" : `Workspace folders (${count})`}
        </span>
      </PopoverTrigger>
      <PopoverPopup side="left" align="start" className="w-96">
        <PopoverTitle>Workspace folders</PopoverTitle>
        <p className="mb-2 text-xs text-muted-foreground">
          Claude in this project can also read and edit these folders.
        </p>
        <WorkspaceFoldersEditor
          project={{ ...project, environmentLabel: null }}
          editable={editable}
        />
      </PopoverPopup>
    </Popover>
  );
}
