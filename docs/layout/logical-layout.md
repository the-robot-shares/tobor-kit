# logical-layout/ — Per-Component Navigation View

Read-only symlink view: one folder per kit component, each holding RELATIVE
symlinks to that component's slices in the real trees (`web/`, `elixir/`,
Swift mirrors, `go/`, `schema/`). Nothing here is a build input — edit the
real files through these links or in place; compilers and tests never touch
`logical-layout/`.

Components: artifact, asset, auth, billing-status, chat-thread, cookie, faq,
footer-brand, guide-panel, human-verify, login-flow, mcp-clients, mcp-config,
mcp-domain, mode-toggle, model-config, npl-view, persona, plan-compare,
invite-gate, prompt, review-panel, robot-avatar, styleguide, subscription-gate, task-menu,
telemetry-toggle, tool-list, transcript-view, voice-agent, voice-session,
waitlist.

When adding a component, create its `logical-layout/<name>/` folder with
relative symlinks per surface.
