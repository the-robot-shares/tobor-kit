/**
 * Every npm component entry must import cleanly where there is no DOM (a
 * server render, a build-time prerender, a test runner in plain Node), and
 * re-evaluating the entry must not throw. Element
 * registration is guarded by `defineOnce`, so without a browser registry the
 * entries load and register nothing (or register into Lit's Node shim).
 */
import { readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const entries = (await readdir(join(dist, "components"), { recursive: true }))
  .filter((path) => path.endsWith(".js"))
  .map((path) => join(dist, "components", path));
entries.push(join(dist, "index.js"));

const failures = [];
for (const path of entries) {
  const url = pathToFileURL(path).href;
  try {
    await import(url);
    // Re-evaluates the entry module only; its chunk imports resolve to the
    // first copy. A true second module graph (second class, second define) is
    // exercised in a browser by scripts/smoke-cdn-registration.mjs.
    await import(`${url}?second-copy`);
  } catch (error) {
    failures.push(`${relative(root, path)}: ${error?.message ?? error}`);
  }
}
if (failures.length) {
  console.error(`assert-ssr-import FAILED:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`assert-ssr-import: OK — ${entries.length} entries import without a DOM (registry: ${"customElements" in globalThis ? "Lit Node shim" : "none"}), twice`);
