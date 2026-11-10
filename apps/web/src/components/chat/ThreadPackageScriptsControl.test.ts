import { describe, expect, it } from "vite-plus/test";

import { parsePackageScripts } from "./ThreadPackageScriptsControl";

describe("parsePackageScripts", () => {
  it.each([
    ['{"scripts":{"dev":"vite","build":"tsc"}}', { runner: "npm", names: ["dev", "build"] }],
    ['{"packageManager":"pnpm@9.1.0","scripts":{"dev":"x"}}', { runner: "pnpm", names: ["dev"] }],
    [
      '{"packageManager":"deno@2","scripts":{"dev":"x","bad":1}}',
      { runner: "npm", names: ["dev"] },
    ],
    ['{"scripts":{}}', null],
    ["{not json", null],
  ])("%s", (contents, expected) => {
    expect(parsePackageScripts(contents)).toEqual(expected);
  });
});
