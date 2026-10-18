# tobor-chat-thread — configuration

Thread chrome around `<tobor-transcript-view>`. Shadow DOM. Hosts own session
creation, tokens, `POST /turn`, and the `TranscriptStore` instance. Markup in
message text is rendered as **text** (no `unsafeHTML`); the inner log
`pre-wrap`s. Optional `**bold**` stays source characters.

## Tags

| Tag | Role |
|---|---|
| `tobor-chat-thread` | Thread roster + composed transcript + optional composer |

Inner custom element (not this family's tag): `tobor-transcript-view`. Store
helpers stay in `transcript-view/transcript-store.ts`.

## Properties / attributes

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `turns` | `Turn[]` | no | `[]` | no | Property-only. Forwarded to the inner view. Ignored while `messages` is nonempty. Ignored by the inner view while `load.status === "not_server_backed"`. |
| `messages` | `ChatThreadMessage[]` | no | `[]` | no | Property-only. `{id?, role, text, at?, participant?}`. Mapped to `Turn[]` with `at` (UTC) and participant name prefixed as plain text. |
| `participants` | `{id: string, name: string}[]` | no | `[]` | no | Property-only. Roster chips; `message.participant` looks up `name` (falls back to the id). |
| `load` | `TranscriptLoad \| null` | no | `undefined` | no | Property-only. Same 501 distinction as transcript-view. |
| `store` | `TranscriptStore` | no | `undefined` | no | Property-only. Forwarded; Clear lives in the inner view. |
| `pending` | `string` | no | `""` | no | HTML attribute. Streaming assistant chunk. |
| `show-composer` | `boolean` | no | `false` | no | HTML attribute `show-composer`. Composer + Send. |

`Turn`: `{id, role: "user"|"assistant"|"system", content, created_at, tool_calls?, usage?}`.

Unknown `messages[].role` values coerce to `"user"`.

`messages` nonempty **wins** over `turns`. After `tobor-transcript-clear`, this
element sets `turns = []`, `messages = []`, `load = null`.

## Events

| Event | Detail | When |
|---|---|---|
| `tobor-transcript-clear` | `{}` | After the inner view's `store.clear()` resolves. Bubbles, composed, from the inner tag through this host. |
| `thread-send` | `{text: string}` | Composer submit or Enter (Shift+Enter inserts a newline). `text` is trimmed; empty values are not emitted. Host owns persistence. |

Bubbles, composed. The composer does **not** append locally.

## Methods

None. Clear is the inner view's footer button (only when `store` is set). Send
is the composer button (only when `show-composer`).

## Slots

None.

## CSS custom properties / `::part()`

| Name | Default | Role |
|---|---|---|
| `--tobor-kit-transcript-height` | `360px` | Max height of the inner `[role="log"]` (inherited) |

Inherited kit tokens (`--tobor-kit-bg`, `--tobor-kit-surface`, `--tobor-kit-fg`,
`--tobor-kit-muted`, `--tobor-kit-accent`, `--tobor-kit-accent-fg`,
`--tobor-kit-border`, `--tobor-kit-radius`, `--tobor-kit-gap`, …) — see
`web/README.md`. Shared sheet: `web/src/components/mode-toggle/theme.ts`.

| `::part()` | Node |
|---|---|
| `root` | Outer `.thread` wrapper |
| `participants` | Roster `<ul>` (when `participants` is nonempty) |
| `participant` | One roster chip |
| `composer` | Composer `<textarea>` |
| `send` | Send `<button>` |

Inner `tobor-transcript-view` parts (`notice`, `empty`, `log`, `turn`) remain
on that element.

## `data-cy` / `data-testid`

Registry `cy_prefix`: `thread`. Hooks live in this element's Shadow DOM.

| Hook | Selector | When |
|---|---|---|
| `thread.root` | `[data-cy="thread.root"]` | Always |
| `thread.composer` | `[data-cy="thread.composer"]` | `show-composer` |
| `thread.send` | `[data-cy="thread.send"]` | `show-composer` |

Inner grandfathered `data-testid` values (`transcript-empty`,
`not-server-backed`, `pending-turn`, `transcript-clear`) stay on
`tobor-transcript-view`.

## Theming

**Shadow DOM.** Restyle through CSS variables on the host (or ancestors) and
`::part()`. Do not pierce this shadow root or the inner transcript-view
shadow root. Message HTML is escaped text with `pre-wrap` on the inner log.
