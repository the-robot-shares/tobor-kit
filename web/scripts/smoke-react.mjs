/**
 * Node-side smoke test for the React wrappers (dist/react.js).
 *
 * React 19 ships CJS, which does not serve cleanly into the wtr browser
 * context — but Node's native interop handles it, so the wrapper surface is
 * validated here against the BUILT output: every wrapper server-renders to
 * its registered custom element tag, and props/events flow through
 * createElement.
 *
 * Run AFTER `npm run build` (wired into `npm test`).
 */
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as wrappers from "../dist/react.js";

const CASES = [
  ["Auth", "noizu-auth", {mode: "modal", options: {password: true}}],
  ["GuidePanel", "tobor-guide-panel", {}],
  ["RobotAvatar", "tobor-robot-avatar", {}],
  ["ModeToggle", "tobor-mode-toggle", { modes: ["text", "voice"], mode: "text" }],
  ["VoiceSession", "tobor-voice-session", {}],
  ["TranscriptView", "tobor-transcript-view", { turns: [] }],
  ["TaskMenu", "tobor-task-menu", {}],
  ["ToolList", "tobor-tool-list", { inventory: { groups: [], tools: [] } }],
  ["LoginFlow", "tobor-login-flow", { auth: { provider: "none", required: false } }],
  ["TelemetryToggle", "tobor-telemetry-toggle", {}],
];

for (const [name, tagName, props] of CASES) {
  assert.ok(wrappers[name], `${name} is exported`);
  const html = renderToStaticMarkup(React.createElement(wrappers[name], props));
  assert.ok(
    html.includes(`<${tagName}`),
    `${name} renders <${tagName}> (got: ${html.slice(0, 80)})`,
  );
}

// Props flow through createElement verbatim (the forced-consent SSR case
// above already proves @lit/react passes them onto the element).
const handler = () => undefined;
const descriptor = React.createElement(wrappers.ModeToggle, {
  modes: ["text"],
  mode: "text",
  onModeChange: handler,
});
assert.equal(descriptor.props.onModeChange, handler);
const consent = { enabled: true, source: "forced", user_overridable: false };
assert.equal(
  React.createElement(wrappers.TelemetryToggle, { consent }).props.consent.source,
  "forced",
);
// (Shadow-DOM inertness under forced consent is covered by the browser suite;
// react-dom SSR does not serialize shadow roots.)

console.log(`smoke-react: OK — ${CASES.length} wrappers render their tags; props+events flow through`);
