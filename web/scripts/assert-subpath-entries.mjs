/**
 * Every subpath the export map advertises must exist in `dist` after a build.
 *
 * The export map and the Vite entry map are maintained by hand and drifted:
 * `./footer-brand.js`, `./llm-inference.js` and `./llm-inference/catalog.js`
 * were published with type declarations and no JavaScript, so a consumer who
 * imported them got a resolution failure at build time rather than anything
 * the kit's own tests would catch. The existing subpath test imports sources,
 * which cannot see that gap. This one reads what was actually emitted.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

const missing = [];
const unchecked = [];

const targets = (value) => {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(targets);
  return [];
};

for (const [subpath, value] of Object.entries(pkg.exports ?? {})) {
  if (subpath === "./package.json") continue;
  for (const target of targets(value)) {
    // Every target, not just `.js`: a types-only entry whose declaration was
    // never emitted, or a future `.mjs`/`.cjs` condition, is the same drift
    // wearing a different extension. Wildcards are the one thing this cannot
    // check by existence, so they are reported rather than silently skipped.
    if (target.includes("*")) {
      unchecked.push(`${subpath} -> ${target}`);
      continue;
    }
    if (!existsSync(resolve(root, target))) missing.push(`${subpath} -> ${target}`);
  }
}

if (missing.length > 0) {
  console.error("Export map subpaths with no emitted file:");
  for (const entry of missing) console.error(`  ${entry}`);
  console.error("\nAdd the entry to `build.lib.entry` in vite.config.ts, or drop the export.");
  process.exit(1);
}

if (unchecked.length > 0) {
  console.warn(`subpath entries: ${unchecked.length} wildcard target(s) not checked by existence:`);
  for (const entry of unchecked) console.warn(`  ${entry}`);
}

console.log(
  `subpath entries: every exported subpath is emitted (${Object.keys(pkg.exports ?? {}).length} subpaths checked)`,
);
