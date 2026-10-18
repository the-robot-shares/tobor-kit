# npl-view — Hologram mirror (wave 4)

Mirrors of `web/src/components/npl-view/` (`tobor-npl-view`).

- `ToborKit.Hologram.Npl.View` — foldable NPL source viewer (contract class B).
- `ToborKit.Hologram.Npl.Tokenizer` — server-side port of `highlight.ts`
  (`tokenizeNpl`, `splitNplSections`, `isNplFoldStart`). Server-side only —
  regexes are fine in `init/3`, never in client `action/3`
  (`docs/PORTING.md` §6.1).

Backend: None. Host owns data flow.

## Usage

```holo
<Npl.View cid="my-npl" source={@source} target="parent" />
```

`cid` is required (class B: without it `init/3` never runs and there is no
state to fold with).

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `source` | `:string` | `""` | Full NPL/prompt-lingua source. |
| `target` | `:string` | `"parent"` | Host-notification target (`"parent" \| "layout" \| "page"`). |
| `class` | `:string` | `""` | Extra classes on the `.tk` root. |

**Mount-only limitation**: `init/3` tokenizes once at mount. Source changing
after mount does not re-tokenize; re-mount with a new `cid` for a new
document.

## Event contract

| Lit event | Mirror action | Params |
|---|---|---|
| `npl-copy` | `:npl_copy` | `%{text: source}` |

The clipboard write stays host-side (no `js_interop` in the mirror); the
mirror only emits.

## Client interactivity

Fold open/close is the only client behavior: an `open` map in state
(`%{key => boolean}`), toggled by `:toggle_fold` — pure set membership ops,
regex-free per the transpiler contract. `<details>` starts open per section,
as in the Lit version.

## Theming

| Token | Default |
|---|---|
| `--tobor-kit-npl-max-height` | `32rem` |

Plus the shared `--tobor-kit-*` palette (`docs/THEMING.md`).

## data-cy (registry.yaml, verbatim)

| Hook | Element |
|---|---|
| `npl.view` | root `<article>` |
| `npl.copy` | copy button |
| `npl.fold` | section `<summary>` |

## Divergences from the Lit component

1. **Mount-only tokenization** (above) — Lit re-tokenizes on every
   `source` change.
2. **Copy does not write the clipboard** — the host action receives
   `:npl_copy %{text}` and owns `navigator.clipboard`.
3. Token CSS classes are precomputed in `init/3` (templates must only call
   public functions that are safe to re-evaluate client-side); the rendered
   classes are identical (`npl-<kind>`).
4. Fold state survives Hologram re-renders via state (the Lit version relied
   on the native `<details>` toggle); user toggles still work natively and
   stay in sync through the state map.
