/**
 * A bare side-effect import of a component entry must survive a consumer bundle.
 *
 * `import "@noizu/tobor-kit/auth.js"` is how consumers register `<noizu-auth>`.
 * The subpath file only re-exports from `dist/chunks/noizu-auth-*.js`, where the
 * class and its registration live. When `sideEffects` in package.json did not
 * list the chunks, esbuild treated that chunk as pure, found none of its
 * re-exports used, and dropped it: a production bundle shipped with no
 * `<noizu-auth>` definition. `assert-subpath-entries` and the CDN smoke tests
 * cannot see this, because neither re-bundles the package the way an npm
 * consumer does.
 *
 * This script links the built package into a throwaway `node_modules`, bundles
 * consumer files containing only side-effect imports with esbuild (which honours
 * `sideEffects`), and asserts that each expected tag's registration call is in
 * the output. Run it after `npm run build`.
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Each case is one consumer file. `auth.js` alone is the exact import that
// shipped empty; the combined case adds entries that are not chunk-hosted, so a
// regression in either shape is caught.
const cases = [
  {name: "auth-only", imports: ["@noizu/tobor-kit/auth.js"], tags: ["noizu-auth", "noizu-phone-input"]},
  {
    name: "several-entries",
    imports: [
      "@noizu/tobor-kit/auth.js",
      "@noizu/tobor-kit/faq",
      "@noizu/tobor-kit/footer-brand.js",
      "@noizu/tobor-kit/guide-panel.js",
    ],
    tags: ["noizu-auth", "noizu-faq", "noizu-footer-brand", "tobor-guide-panel"],
  },
];

// Registration is `defineElement("tag")` (0.1.8+) or Lit's `customElement("tag")`.
// esbuild may suffix a renamed binding (`defineElement2`), so match the family.
const registers = (code, tag) =>
  new RegExp(`\\b(?:defineElement|customElement|defineOnce)\\w*\\(\\s*["'\`]${tag}["'\`]`).test(code);

const work = mkdtempSync(join(tmpdir(), "tobor-kit-bundle-"));
const failures = [];
try {
  mkdirSync(join(work, "node_modules", "@noizu"), {recursive: true});
  symlinkSync(root, join(work, "node_modules", "@noizu", "tobor-kit"), "dir");

  for (const c of cases) {
    const entry = join(work, `${c.name}.js`);
    writeFileSync(entry, c.imports.map((spec) => `import ${JSON.stringify(spec)};`).join("\n") + "\n");
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      minify: false,
      logLevel: "silent",
      absWorkingDir: work,
      nodePaths: [join(root, "node_modules")],
    });
    const code = result.outputFiles[0].text;
    for (const tag of c.tags) {
      if (!registers(code, tag)) failures.push(`${c.name}: bundle has no registration for <${tag}>`);
    }
  }
} finally {
  rmSync(work, {recursive: true, force: true});
}

if (failures.length) {
  console.error("Side-effect imports were tree-shaken out of a consumer bundle:");
  for (const f of failures) console.error(`  ${f}`);
  console.error('Check "sideEffects" in package.json covers every directory the build emits element code into.');
  process.exit(1);
}
console.log(`assert-bundle-side-effects: ${cases.length} consumer bundles register every expected tag`);
