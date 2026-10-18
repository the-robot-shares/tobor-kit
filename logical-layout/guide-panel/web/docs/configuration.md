# tobor-guide-panel — configuration

Full options surface for `<tobor-guide-panel>`. Condensed usage lives in
[../README.md](../README.md). If the two drift, this file wins.

## Tags

| Tag | Role |
|-----|------|
| `tobor-guide-panel` | Orchestrator: header + avatar, modes, turn streaming, task menu, tool list, telemetry footer |

Child elements (`tobor-robot-avatar`, `tobor-mode-toggle`, `tobor-voice-session`,
`tobor-transcript-view`, `tobor-task-menu`, `tobor-tool-list`,
`tobor-telemetry-toggle`) are owned by their own families.

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|------|------|----------|---------|----------|-------|
| `guide` | `GuideProjection` | no | — | no | Property-only. Fetched via `client.getGuide()` (`GET /guide`) on connect when omitted. |
| `client` | `ToborKitClient` | in practice | — | no | Property-only. Built from `base-url` / `token` when omitted. One of `client` or `base-url` required in practice. |
| `baseUrl` (`base-url`) | string | no | — | no | Guide API origin. Client default is `/api/tobor-kit` when neither `client` nor `base-url` is set. |
| `token` | string | no | — | no | Bearer token, re-read into the constructed client. Host-injected. Never a provider API key. |
| `placement` | `"floating" \| "docked" \| "inline"` | no | `floating` | yes | Overridden by `guide.ui.panel.placement` after the projection loads. |
| `startExpanded` (`start-expanded`) | boolean | no | `false` | no | Overridden by `guide.ui.panel.start_expanded`. |

## Events

All events bubble and are composed.

| Event | Detail | When |
|-------|--------|------|
| `tobor-task-invoked` | `{task_id}` | A task-menu selection is recorded. `task_id` is advisory on the next turn. |
| `tobor-turn-submitted` | `{input, task_id?}` | A user turn is submitted (typed send or voice transcript). |
| `tobor-state-change` | `{state}` | Each SSE `state` frame (`idle`, `listening`, `thinking`, `speaking`, `tool_running`, `error`, `offline`). |
| `tobor-turn-error` | `{error: {code, message}}` | Stream `error` frame, HTTP failure, or synthetic `stream_incomplete`. |
| `tobor-turn-message` | `{turn}` | Terminal SSE `message` finalizes the assistant turn. |

## Methods

None. Session open, inventory fetch, and turn submit are internal.

## Slots

None.

## CSS custom properties / `::part()`

| Name | Default | Role |
|------|---------|------|
| `--tobor-kit-panel-width` | `360px` floating; `480px` docked/inline (`max-width`) | Panel width |
| `--tobor-kit-bg` | `#12131a` | Panel background |
| `--tobor-kit-surface` | `#1b1d27` | Inputs, surfaces |
| `--tobor-kit-fg` | `#e8e9f0` | Text |
| `--tobor-kit-muted` | `#9aa0b4` | Secondary text |
| `--tobor-kit-accent` | `#6ee7c7` | Accent |
| `--tobor-kit-accent-fg` | `#08130f` | Text on accent |
| `--tobor-kit-border` | `#2c2f3d` | Borders |
| `--tobor-kit-danger` / `--tobor-kit-warn` | red / amber | Error + notices |
| `--tobor-kit-radius`, `--tobor-kit-gap`, `--tobor-kit-shadow`, `--tobor-kit-duration` | kit defaults | Shape + rhythm |

`::part()`:

| Part | Node |
|------|------|
| `panel` | Outer `.panel` |
| `header` | Header row (avatar, name, actions) |
| `footer` | Footer (telemetry, expand/collapse) |

## `data-cy` / `data-testid` hooks

Registry freeze: `cy_prefix: guide` (`web/registry.yaml`). New hooks would be
`data-cy="guide.<name>"`. This element still uses grandfathered `data-testid`
inside Shadow DOM:

| Hook | When present |
|------|----------------|
| `panel-loading` | Projection not yet loaded |
| `panel-error` | `GET /guide` failed (`guide_unavailable`) |
| `greeting` | Expanded; projection has `greeting` |
| `turn-error` | Expanded; last turn failed |
| `tools-toggle` | `ui.panel.show_tool_list !== false` |
| `text-input` | Text mode, expanded |
| `send` | Text mode, expanded |
| `expand` | Collapsed |
| `collapse` | Expanded |

## Theming

Shadow DOM. Tokens on `:host`; no shadow piercing. The projection's free-form
`ui.theme` map is applied on the host: keys already starting with `--` are set
as-is; other keys become `--tobor-kit-<kebab-key>`.
