import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * Multi-entry library build.
 *
 * Every public subpath is its own entry so a consumer can load a single
 * element without dragging the rest of the kit in. `lit`, `@lit/react` and
 * `react` are peer dependencies and are externalised — a kit with N elements
 * must not ship N copies of Lit. `scripts/assert-no-lit.mjs` enforces that
 * after the build.
 */
export default defineConfig({
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    lib: {
      formats: ["es"],
      entry: {
        "components/auth/noizu-auth": resolve(__dirname, "src/components/auth/noizu-auth.ts"),

        "components/voice-agent/voice-agent": resolve(__dirname, "src/components/voice-agent/voice-agent.ts"),
        index: resolve(__dirname, "src/index.ts"),
        client: resolve(__dirname, "src/client.ts"),
        react: resolve(__dirname, "src/react.ts"),
        "components/transcript-view/transcript-store": resolve(__dirname, "src/components/transcript-view/transcript-store.ts"),
        "components/voice-session/index": resolve(__dirname, "src/components/voice-session/index.ts"),
        "components/guide-panel/guide-panel": resolve(__dirname, "src/components/guide-panel/guide-panel.ts"),
        "components/robot-avatar/robot-avatar": resolve(__dirname, "src/components/robot-avatar/robot-avatar.ts"),
        "components/mode-toggle/mode-toggle": resolve(__dirname, "src/components/mode-toggle/mode-toggle.ts"),
        "components/footer-brand/noizu-footer-brand": resolve(__dirname, "src/components/footer-brand/noizu-footer-brand.ts"),
        "components/llm-inference/llm-inference": resolve(__dirname, "src/components/llm-inference/llm-inference.ts"),
        "components/llm-inference/catalog": resolve(__dirname, "src/components/llm-inference/catalog.ts"),
        "components/voice-session/voice-session": resolve(__dirname, "src/components/voice-session/voice-session.ts"),
        "components/transcript-view/transcript-view": resolve(__dirname, "src/components/transcript-view/transcript-view.ts"),
        "components/task-menu/task-menu": resolve(__dirname, "src/components/task-menu/task-menu.ts"),
        "components/tool-list/tool-list": resolve(__dirname, "src/components/tool-list/tool-list.ts"),
        "components/login-flow/login-flow": resolve(__dirname, "src/components/login-flow/login-flow.ts"),
        "components/telemetry-toggle/telemetry-toggle": resolve(__dirname, "src/components/telemetry-toggle/telemetry-toggle.ts"),
        "components/waitlist/noizu-waitlist": resolve(__dirname, "src/components/waitlist/noizu-waitlist.ts"),
        "components/cookie/noizu-cookie-consent": resolve(__dirname, "src/components/cookie/noizu-cookie-consent.ts"),
        "components/cookie/noizu-cookie-settings": resolve(__dirname, "src/components/cookie/noizu-cookie-settings.ts"),
        "components/faq/noizu-faq": resolve(__dirname, "src/components/faq/noizu-faq.ts"),
        "components/billing-status/noizu-billing-status": resolve(__dirname, "src/components/billing-status/noizu-billing-status.ts"),
        "components/plan-compare/noizu-plan-compare": resolve(__dirname, "src/components/plan-compare/noizu-plan-compare.ts"),
        "components/phone-input/noizu-phone-input": resolve(__dirname, "src/components/phone-input/noizu-phone-input.ts"),
        "components/human-verify/noizu-human-verify": resolve(__dirname, "src/components/human-verify/noizu-human-verify.ts"),
        "components/subscription-gate/noizu-subscription-gate": resolve(__dirname, "src/components/subscription-gate/noizu-subscription-gate.ts"),
        "components/invite-gate/noizu-invite-gate": resolve(__dirname, "src/components/invite-gate/noizu-invite-gate.ts"),
        "components/invite-gate/invite-required": resolve(__dirname, "src/components/invite-gate/invite-required.ts"),
        "components/model-config/noizu-model-config": resolve(__dirname, "src/components/model-config/noizu-model-config.ts"),
        "components/configurator/tobor-configurator": resolve(__dirname, "src/components/configurator/tobor-configurator.ts"),
        "components/chat-thread/chat-thread": resolve(__dirname, "src/components/chat-thread/chat-thread.ts"),
        "components/page-comments/page-comments": resolve(__dirname, "src/components/page-comments/page-comments.ts"),
        "components/page-comments/lightbox": resolve(__dirname, "src/components/page-comments/lightbox.ts"),
        "components/page-comments/snip": resolve(__dirname, "src/components/page-comments/snip.ts"),
        "components/persona/persona-card": resolve(__dirname, "src/components/persona/persona-card.ts"),
        "components/persona/persona-picker": resolve(__dirname, "src/components/persona/persona-picker.ts"),
        "components/party-card/party-card": resolve(__dirname, "src/components/party-card/party-card.ts"),
        "components/party-card/agent-card": resolve(__dirname, "src/components/party-card/agent-card.ts"),
        "components/party-card/user-card": resolve(__dirname, "src/components/party-card/user-card.ts"),
        "components/styleguide/noizu-sg-btn": resolve(__dirname, "src/components/styleguide/noizu-sg-btn.ts"),
        "components/styleguide/noizu-sg-card": resolve(__dirname, "src/components/styleguide/noizu-sg-card.ts"),
        "components/styleguide/noizu-sg-card-grid": resolve(__dirname, "src/components/styleguide/noizu-sg-card-grid.ts"),
        "components/styleguide/noizu-sg-status": resolve(__dirname, "src/components/styleguide/noizu-sg-status.ts"),
        "components/styleguide/noizu-sg-select": resolve(__dirname, "src/components/styleguide/noizu-sg-select.ts"),
        "components/styleguide/noizu-sg-input": resolve(__dirname, "src/components/styleguide/noizu-sg-input.ts"),
        "components/styleguide/noizu-sg-spec-table": resolve(__dirname, "src/components/styleguide/noizu-sg-spec-table.ts"),
        "components/styleguide/noizu-sg-steps": resolve(__dirname, "src/components/styleguide/noizu-sg-steps.ts"),
        "components/asset/asset-view": resolve(__dirname, "src/components/asset/asset-view.ts"),
        "components/asset/asset-editor": resolve(__dirname, "src/components/asset/asset-editor.ts"),
        "components/artifact/tobor-artifact-view": resolve(__dirname, "src/components/artifact/tobor-artifact-view.ts"),
        "components/artifact/tobor-artifact-editor": resolve(__dirname, "src/components/artifact/tobor-artifact-editor.ts"),
        "components/review-panel/review-panel": resolve(__dirname, "src/components/review-panel/review-panel.ts"),
        "components/wiki/tobor-wiki-space": resolve(__dirname, "src/components/wiki/tobor-wiki-space.ts"),
        "components/wiki/tobor-wiki-entry": resolve(__dirname, "src/components/wiki/tobor-wiki-entry.ts"),
        "components/wiki/tobor-wiki-entry-editor": resolve(__dirname, "src/components/wiki/tobor-wiki-entry-editor.ts"),
        "components/npl-view/npl-view": resolve(__dirname, "src/components/npl-view/npl-view.ts"),
        "components/mcp-domain/tobor-mcp-domain": resolve(__dirname, "src/components/mcp-domain/tobor-mcp-domain.ts"),
        "components/mcp-config/tobor-mcp-config": resolve(__dirname, "src/components/mcp-config/tobor-mcp-config.ts"),
        "components/mcp-clients/tobor-mcp-clients": resolve(__dirname, "src/components/mcp-clients/tobor-mcp-clients.ts"),
        "components/prompt/tobor-prompt-library": resolve(__dirname, "src/components/prompt/tobor-prompt-library.ts"),
        "components/prompt/tobor-prompt-history": resolve(__dirname, "src/components/prompt/tobor-prompt-history.ts"),
      },
    },
    rollupOptions: {
      external: [/^lit(\/.*)?$/, /^@lit\/.*/, /^react(\/.*)?$/, /^@zumer\/.*/, /^phoenix$/],
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
  esbuild: {
    // Lit decorators are the legacy TS flavour.
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
        target: "es2022",
      },
    },
  },
});
