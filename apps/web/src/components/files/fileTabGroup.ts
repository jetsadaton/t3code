import type { RightPanelSurface } from "../../rightPanelStore";

export type WorkspaceFileSurface = Extract<RightPanelSurface, { kind: "files" | "file" }>;

export const isWorkspaceFileSurface = (
  surface: RightPanelSurface,
): surface is WorkspaceFileSurface =>
  surface.kind === "files" || (surface.kind === "file" && surface.attachment === undefined);

/**
 * Folds the file tree and every open workspace file into one "Files" tab, so the top tab row
 * stays short; the open files get their own row inside that tab. The folded tab keeps the id of
 * the member it shows, so activating it returns to that file.
 */
export function collapseFileSurfaces(
  surfaces: ReadonlyArray<RightPanelSurface>,
  activeSurfaceId: string | null,
): { tabs: Array<RightPanelSurface>; openFiles: Array<WorkspaceFileSurface> } {
  const members = surfaces.filter(isWorkspaceFileSurface);
  if (members.length === 0) return { tabs: [...surfaces], openFiles: [] };
  const shown = members.find((member) => member.id === activeSurfaceId) ?? members.at(-1)!;
  // Typed as the tree so tab title and icon read "Files"; only the id is used to act on it.
  const folded = { ...shown, kind: "files" } as RightPanelSurface;
  let placed = false;
  const tabs = surfaces.flatMap((surface) => {
    if (!isWorkspaceFileSurface(surface)) return [surface];
    if (placed) return [];
    placed = true;
    return [folded];
  });
  return { tabs, openFiles: members.filter((member) => member.kind === "file") };
}
