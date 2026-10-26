import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() && !["node_modules", "dist", ".expo"].includes(e.name)
        ? walk(path.join(dir, e.name))
        : e.isFile()
          ? [path.join(dir, e.name)]
          : [],
    );
}
const files = ["apps", "packages", "tests", "scripts"].flatMap(walk);
if (files.some((f) => /\.tsx?$/.test(f)))
  throw Error("Project source must use JavaScript/JSX only");
for (const file of files.filter((f) => /\.[cm]?js$/.test(f))) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (result.status) process.exit(result.status);
}
console.log(
  "JavaScript syntax checked. JSX is checked by the web build and Expo export.",
);
