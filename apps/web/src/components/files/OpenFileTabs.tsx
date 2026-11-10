import { useTheme } from "~/hooks/useTheme";
import { cn } from "~/lib/utils";

import { PierreEntryIcon } from "../chat/PierreEntryIcon";
import { PanelTabCloseButton } from "../ui/panel-tab-close-button";
import type { WorkspaceFileSurface } from "./fileTabGroup";

const fileName = (path: string) =>
  path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);

/** The second tab row inside the Files tab: one tab per open file. */
export function OpenFileTabs(props: {
  files: ReadonlyArray<WorkspaceFileSurface>;
  activeSurfaceId: string | null;
  pendingSurfaceIds: ReadonlySet<string>;
  onActivate: (surface: WorkspaceFileSurface) => void;
  onClose: (surface: WorkspaceFileSurface) => void;
}) {
  const { resolvedTheme } = useTheme();
  if (props.files.length === 0) return null;
  return (
    <div
      role="tablist"
      aria-label="Open files"
      className="flex shrink-0 overflow-x-auto border-b bg-muted/30 text-xs"
    >
      {props.files.map((surface) => {
        if (surface.kind !== "file") return null;
        const active = surface.id === props.activeSurfaceId;
        const pending = props.pendingSurfaceIds.has(surface.id);
        return (
          <div
            key={surface.id}
            className={cn(
              "group/tab flex shrink-0 items-center gap-1.5 border-r py-1 pl-2.5 pr-1.5",
              active
                ? "-mb-px border-b-2 border-b-primary bg-background text-foreground"
                : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className="flex cursor-pointer items-center gap-1.5"
              onClick={() => props.onActivate(surface)}
            >
              <PierreEntryIcon
                pathValue={surface.relativePath}
                kind="file"
                theme={resolvedTheme}
                className="size-3"
              />
              <span className="max-w-40 truncate">{fileName(surface.relativePath)}</span>
            </button>
            <PanelTabCloseButton
              label={`Close ${fileName(surface.relativePath)}`}
              onClick={() => props.onClose(surface)}
            >
              {pending ? <span className="size-1.5 rounded-full bg-foreground/70" /> : null}
            </PanelTabCloseButton>
          </div>
        );
      })}
    </div>
  );
}
