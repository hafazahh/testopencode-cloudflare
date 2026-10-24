import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
function walk(dir, prefix = "") {
  let entries = readdirSync(dir, { withFileTypes: true });
  entries = entries.filter(e => e.name !== "node_modules");
  for (const e of entries) {
    const p = join(dir, e.name);
    const child = prefix + e.name + "/";
    if (e.isDirectory()) {
      console.log(child);
      walk(p, child);
    } else {
      console.log(prefix + e.name);
    }
  }
}
walk(process.argv[2] || "node_modules/miniflare/dist/src/d1");
