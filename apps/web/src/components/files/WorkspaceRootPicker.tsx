import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";

const folderName = (root: string) =>
  root
    .replace(/[\\/]+$/, "")
    .split(/[\\/]/)
    .pop() || root;

/** Picks one folder of a multi-folder workspace. The first root is the project folder. */
export function WorkspaceRootPicker(props: {
  roots: ReadonlyArray<string>;
  value: string;
  onChange: (root: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">Folder</span>
      <Select
        value={props.value}
        onValueChange={(value) => {
          if (typeof value === "string") props.onChange(value);
        }}
      >
        <SelectTrigger size="sm" aria-label="Workspace folder">
          <SelectValue>{folderName(props.value)}</SelectValue>
        </SelectTrigger>
        <SelectPopup align="start" alignItemWithTrigger={false}>
          {props.roots.map((root) => (
            <SelectItem key={root} value={root} title={root}>
              {folderName(root)}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  );
}
