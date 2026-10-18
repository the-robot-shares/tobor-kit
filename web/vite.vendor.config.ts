import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * Vendor build: single-file ESM bundles of `lit` and `lit/decorators.js`
 * for host pages WITHOUT an import map of their own. These are the
 * sanctioned exception to the "no lit in dist/" rule enforced by
 * scripts/assert-no-lit.mjs, which skips dist/vendor/.
 */
export default defineConfig({
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    minify: true,
    lib: {
      formats: ["es"],
      entry: {
        "vendor/lit": fileURLToPath(new URL("./node_modules/lit/index.js", import.meta.url)),
        "vendor/lit-decorators": fileURLToPath(new URL("./node_modules/lit/decorators.js", import.meta.url)),
        "vendor/lit-directives-class-map": fileURLToPath(new URL("./node_modules/lit/directives/class-map.js", import.meta.url)),
        "vendor/lit-directives-style-map": fileURLToPath(new URL("./node_modules/lit/directives/style-map.js", import.meta.url)),
        "vendor/lit-directives-live": fileURLToPath(new URL("./node_modules/lit/directives/live.js", import.meta.url)),
        "vendor/lit-directives-if-defined": fileURLToPath(new URL("./node_modules/lit/directives/if-defined.js", import.meta.url)),
        "vendor/lit-directives-unsafe-html": fileURLToPath(new URL("./node_modules/lit/directives/unsafe-html.js", import.meta.url)),
        "vendor/snapdom": fileURLToPath(new URL("./node_modules/@zumer/snapdom/dist/snapdom.mjs", import.meta.url)),
        "vendor/phoenix": fileURLToPath(new URL("./node_modules/phoenix/priv/static/phoenix.mjs", import.meta.url)),
      },
    },
    rollupOptions: {
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
        target: "es2022",
      },
    },
  },
});
