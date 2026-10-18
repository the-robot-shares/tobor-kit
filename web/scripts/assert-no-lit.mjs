/**
 * Build gate: `lit`, `@lit/*` and `react` are peer dependencies and must be
 * EXTERNALISED, never bundled into dist/.
 *
 * Signals checked, in order of strength:
 *  1. dist must still contain import statements whose specifier is "lit" or
 *     "lit/..." — externalising keeps the specifier; bundling removes it.
 *  2. no dist file may DECLARE lit's base classes (`class LitElement`,
 *     `class ReactiveElement`) — an external import only references them;
 *     a declaration means the runtime was inlined.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist", import.meta.url));

// dist/vendor/ is the sanctioned exception: single-file lit bundles built by
// vite.vendor.config.ts for CDN hosts without an import map.
const vendorDir = join(dist, "vendor") + "/";

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (p === vendorDir) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".js")) out.push(p);
  }
  return out;
}

let files;
try {
  files = walk(dist);
} catch {
  console.error("assert-no-lit: cannot read dist/ — run the build first");
  process.exit(1);
}

if (!files.length) {
  console.error("assert-no-lit: dist/ has no .js output — run the build first");
  process.exit(1);
}

const litSpecifier = /from\s*["'](lit|lit\/[^"']*)["']/;
const classDeclaration = /\bclass\s+(LitElement|ReactiveElement)\b/;

let imports = 0;
const offenders = [];
for (const file of files) {
  const src = readFileSync(file, "utf8");
  if (litSpecifier.test(src)) imports += 1;
  if (classDeclaration.test(src)) offenders.push(file);
}

if (offenders.length > 0) {
  console.error(
    `assert-no-lit: FAILED — lit runtime is BUNDLED into dist/ (class declarations found):\n` +
      offenders.map((f) => `  ${f}`).join("\n"),
  );
  process.exit(1);
}

if (imports === 0) {
  console.error(
    "assert-no-lit: FAILED — no external 'lit' imports in dist/. " +
      "The peer dependency was swallowed instead of externalised.",
  );
  process.exit(1);
}

console.log(`assert-no-lit: OK — ${imports} file(s) import lit externally; no lit runtime in dist/`);
