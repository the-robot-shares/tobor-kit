# tobor-transcript-view — configuration

Scrollable conversation log with streaming pending text and an optional Clear
affordance. Shadow DOM. Hosts own session creation, tokens, and the
`TranscriptStore` instance.

## Tags

| Tag | Role |
|---|---|
| `tobor-transcript-view` | Conversation transcript |

Colocated helper (not a custom element): `transcript-store.ts` —
`createMemoryStore`, `createLocalStore`, `createBackendStore`, `storeForGuide`.

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `turns` | `Turn[]` | no | `[]` | no | Property-only. Ignored while `load.status === "not_server_backed"`. |
| `load` | `TranscriptLoad \| null` | no | `undefined` | no | Property-only. `{status:"ok", turns, has_more}` or `{status:"not_server_backed"}`. A 501 from `GET /sessions/{id}/transcript` maps to `not_server_backed` — not empty, not an error. |
| `store` | `TranscriptStore` | no | `undefined` | no | Property-only. When set, the Clear button renders and calls `store.clear()`. |
| `pending` | `string` | no | `""` | no | HTML attribute. Streaming assistant text not yet a turn. Suppresses the empty state. |

`Turn`: `{id, role: "user"\|"assistant"\|"system", content, created_at, tool_calls?, usage?}`.

Three mutually exclusive render states:

1. `load.status === "not_server_backed"` → dashed notice (turns ignored)
2. no turns and no `pending` → empty copy
3. otherwise → the log (turns + optional pending bubble)

## Events

| Event | Detail | When |
|---|---|---|
| `tobor-transcript-clear` | `{}` | After `store.clear()` resolves; the element then sets `turns = []` and `load = null` |

Bubbles, composed. No other events.

## Methods

None. Clear is the footer button (only when `store` is set).

## Slots

None.

## CSS custom properties / `::part()`

| Name | Default | Role |
|---|---|---|
| `--tobor-kit-transcript-height` | `360px` | Max height of `[role="log"]` |

Inherited kit tokens (`--tobor-kit-bg`, `--tobor-kit-surface`, `--tobor-kit-fg`,
`--tobor-kit-muted`, `--tobor-kit-accent`, `--tobor-kit-accent-fg`,
`--tobor-kit-border`, `--tobor-kit-radius`, …) — see `web/README.md`.

| `::part()` | Node |
|---|---|
| `notice` | Not-server-backed copy |
| `empty` | Empty copy |
| `log` | Scrollable `[role="log"]` |
| `turn` | One turn bubble |

## `data-cy` / `data-testid`

Registry `cy_prefix`: `transcript`. No `cy:` hooks frozen yet; agent
`data-testid` values are grandfathered.

| Hook | Selector | When |
|---|---|---|
| `not-server-backed` | `[data-testid="not-server-backed"]` | 501 / client store |
| `transcript-empty` | `[data-testid="transcript-empty"]` | No turns and no pending |
| `pending-turn` | `[data-testid="pending-turn"]` | `pending` is non-empty |
| `transcript-clear` | `[data-testid="transcript-clear"]` | `store` is set |
| `turn-tools` | `[data-testid="turn-tools"]` | A turn has `tool_calls` |

Turns also expose `data-role` (`user` \| `assistant` \| `system`) and
`data-turn-id`.

## Theming

**Shadow DOM.** Restyle through CSS variables on the host (or ancestors) and
`::part()`. Do not pierce the shadow root. User bubbles use the accent tokens;
assistant bubbles use surface; system turns are muted and full-width.
