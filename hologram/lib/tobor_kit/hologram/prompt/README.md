# Prompt family (Hologram mirrors)

Ports of the Lit prompt components:

- `web/src/components/prompt/tobor-prompt-library.ts` → `ToborKit.Hologram.Prompt.Library`
- `web/src/components/prompt/tobor-prompt-history.ts` → `ToborKit.Hologram.Prompt.History`

## Usage

```elixir
<Library cid="my-library" prompts={@prompts} target="page" />

<History cid="my-history" entries={@history_entries} diff={@prompt_diff} target="page" />
```

`cid` is required on both.

## Props

### Library

| Prop | Type | Default |
|---|---|---|
| `prompts` | list of string-keyed maps (`id`/`title`/`body`/`starred`) | `[]` |
| `target` | string | `"parent"` |

Live query filtering runs client-side with **client-safe string ops only**
(PORTING.md §6.1): ASCII-only case folding, split-based substring test,
graphemes-based trim. Unicode case folding happens server-side only in the
initial `init/3` filter — documented divergence.

### History

| Prop | Type | Default |
|---|---|---|
| `entries` | list of `{id, title, at, version?, starred?}` maps | `[]` |
| `diff` | map with `left`/`right` `{label, body}` panes | `nil` |
| `target` | string | `"parent"` |

Stamps (`"v1 · 2026-01-01 12:00 UTC"`) are precomputed in `init/3`
(`DateTime.from_iso8601` is not client-transpilable). Bodies render as source
text in `<pre>` (Lit `promptPlainText` parity); the Lit diff **slot** is not
portable — the `diff` prop drives the panes instead (PORTING.md §4).

## Event contract

| Lit `CustomEvent` | Hologram action | Params |
|---|---|---|
| `prompt-select` | `:prompt_select` | `%{id}` |
| `prompt-star` | `:prompt_star` | `%{id, starred}` |
| `prompt-fork` | `:prompt_fork` | `%{id}` |

## Theming

`.tk-prompt-library__*` (search, roster rows, clamped scrollable bodies) and
`.tk-prompt-history__*` (rows, stamps, side-by-side diff panes). Family public
tokens:

- `--tobor-kit-prompt-body-max-height` — library body clamp (default `6rem`).
- `--tobor-kit-prompt-diff-min` — min diff pane width (default `12rem`).

## data-cy

| Tag | Hooks |
|---|---|
| prompt-library | `prompt.library`, `prompt.item`, `prompt.star` |
| prompt-history | `prompt.history`, `prompt.fork`, `prompt.star` |

## Divergences

- ASCII-only client filter matching (see above); hosts needing Unicode-insensitive
  search should filter server-side and pass a pre-filtered roster.
- History diff slot → prop-driven panes (see above).

## Backend

None. Host owns prompt storage, forking and starring persistence — the mirrors
only report intent.
