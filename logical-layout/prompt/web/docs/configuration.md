# prompt family — configuration

Shadow DOM. Hosts own load and persistence. Prompt bodies / diff panes are
rendered as **text** (no `unsafeHTML`); `<pre>` `pre-wrap`s. Source characters
stay source.

## Tags

| Tag | Role |
|---|---|
| `tobor-prompt-library` | Searchable prompt roster. Emits `prompt-select` and `prompt-star`. |
| `tobor-prompt-history` | Revision list + optional side-by-side diff. Emits `prompt-fork` and `prompt-star`. |

Primary playground tag (`configurator`): `tobor-prompt-library`. Both:
`configurators`.

## Properties / attributes

### `tobor-prompt-library`

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `prompts` | `PromptRecord[]` | no | `[]` | no | Property-only. `{id, title, body, starred?}[]`. Host loads. |
| `query` | `string` | no | `""` | yes | HTML attribute. Filters id / title / body (case-insensitive). |
| `selected-id` (`selectedId`) | `string` | no | `""` | no | HTML attribute. Highlighted id. Also set locally on select. |

`PromptRecord`: `{id: string, title: string, body: string, starred?: boolean}`.
Empty / non-array `prompts` shows “No prompts.” A non-empty roster with no
query matches shows “No matching prompts.” Empty `id` does not emit.

Star click copies the roster with `starred` flipped, then emits. The host
persists; a later `prompts` assignment is source of truth.

### `tobor-prompt-history`

| Name | Type | Required | Default | Reflect? | Notes |
|---|---|---|---|---|---|
| `entries` | `PromptHistoryEntry[]` | no | `[]` | no | Property-only. `{id, title, at, version?, starred?}[]`. |
| `diff` | `PromptDiff \| null` | no | `null` | no | Property-only. `{left?: {label?, body}, right?: {label?, body}}`. Hidden when the `diff` slot has content. |

`PromptHistoryEntry.at` is shown as `YYYY-MM-DD HH:MM UTC` when parseable,
otherwise as given. `version` is prefixed with `v` when set. Empty / non-array
`entries` shows “No history.” Empty `id` does not emit.

Bodies in `diff` use `promptPlainText` into `<pre>` — never parsed as HTML.

## Events

| Event | Tag | Detail | When |
|---|---|---|---|
| `prompt-select` | `tobor-prompt-library` | `{id: string}` | Prompt button click. Host applies the prompt. |
| `prompt-star` | both | `{id: string, starred: boolean}` | Star click. Host persists. `starred` is the **new** value. |
| `prompt-fork` | `tobor-prompt-history` | `{id: string}` | Fork click. Host copies the revision. |

Bubbles, composed. The islands do **not** fetch or write.

## Methods

None.

## Slots

| Tag | Slot | When |
|---|---|---|
| `tobor-prompt-history` | `diff` | Optional. Host-provided version diff. When assigned, built-in side-by-side panes are omitted. |

`tobor-prompt-library` has no slots.

## CSS custom properties / `::part()`

Inherited kit tokens (`--tobor-kit-bg`, `--tobor-kit-surface`, `--tobor-kit-fg`,
`--tobor-kit-muted`, `--tobor-kit-accent`, `--tobor-kit-accent-fg`,
`--tobor-kit-border`, `--tobor-kit-radius`, `--tobor-kit-gap`, …) — see
`web/README.md`. Shared sheet: `web/src/components/mode-toggle/theme.ts`.

| Name | Default | Role |
|---|---|---|
| `--tobor-kit-prompt-body-max-height` | `6rem` (library) / `24rem` (history) | Max height of body / diff `<pre>` |
| `--tobor-kit-prompt-diff-min` | `12rem` | Minimum width of a history diff pane |

| Tag | `::part()` | Node |
|---|---|---|
| `tobor-prompt-library` | `root` | Outer `.library` |
| `tobor-prompt-library` | `search` | Search `<input>` |
| `tobor-prompt-library` | `list` | Prompt `<ul>` |
| `tobor-prompt-library` | `item` | Select `<button>` |
| `tobor-prompt-library` | `title` | Title `<span>` |
| `tobor-prompt-library` | `body` | Body snippet `<pre>` |
| `tobor-prompt-library` | `star` | Star `<button>` |
| `tobor-prompt-library` | `empty` | Empty copy |
| `tobor-prompt-history` | `root` | Outer `.history` |
| `tobor-prompt-history` | `list` | Entry `<ul>` |
| `tobor-prompt-history` | `item` | Entry row |
| `tobor-prompt-history` | `title` | Title `<span>` |
| `tobor-prompt-history` | `stamp` | Version + timestamp |
| `tobor-prompt-history` | `fork` | Fork `<button>` |
| `tobor-prompt-history` | `star` | Star `<button>` |
| `tobor-prompt-history` | `empty` | Empty copy |
| `tobor-prompt-history` | `diff` | Built-in side-by-side wrapper |
| `tobor-prompt-history` | `left` / `right` | Diff panes |
| `tobor-prompt-history` | `diff-label` | Pane label |
| `tobor-prompt-history` | `diff-body` | Pane `<pre>` |

## `data-cy` / `data-testid`

Registry `cy_prefix`: `prompt`. Hooks live in each element's Shadow DOM.

| Hook | Selector | Tag | When |
|---|---|---|---|
| `prompt.library` | `[data-cy="prompt.library"]` | `tobor-prompt-library` | Always |
| `prompt.item` | `[data-cy="prompt.item"]` | `tobor-prompt-library` | One per visible prompt (`data-prompt-id`) |
| `prompt.star` | `[data-cy="prompt.star"]` | both | One per row (`data-prompt-id`) |
| `prompt.history` | `[data-cy="prompt.history"]` | `tobor-prompt-history` | Always |
| `prompt.fork` | `[data-cy="prompt.fork"]` | `tobor-prompt-history` | One per entry (`data-prompt-id`) |

No `data-testid` hooks. Prefix freeze: `prompt`.

## Theming

**Shadow DOM.** Restyle through CSS variables on the host (or ancestors) and
`::part()`. Do not pierce these shadow roots. Prompt / diff HTML is escaped
text with `pre-wrap` on `<pre>`. Starred controls use `aria-pressed="true"`
(kit accent fill from `toborKitControls`).
