import { esbuildPlugin } from "@web/dev-server-esbuild";

export default {
  nodeResolve: true,
  plugins: [
    esbuildPlugin({
      ts: true,
      target: "es2022",
      tsconfig: "tsconfig.json",
    }),
  ],
  files: [
    "test/**/*.test.ts",
    "src/components/**/test/unit/**/*.test.ts",
  ],
  nodeResolveOpts: { extensions: [".ts", ".js"] },
  // Serialized: the island elements react to shared-localStorage events, so
  // parallel test-file iframes interfere with each other.
  concurrentBrowsers: 1,
  concurrency: 1,
};
