# transcript-view — Hologram mirror (wave 4)

Mirror of `web/src/components/transcript-view/transcript-view.ts`
(`tobor-transcript-view`) → `ToborKit.Hologram.TranscriptView.View`
(contract class C, stateless).

Three visually distinct render states preserved from the Lit source:

1. turns present → the log
2. empty turns → "Nothing said yet."
3. `not_server_backed` load → "the server stores no copy" (the GET
   /transcript 501 distinction — not an error, not an empty transcript)

Backend: None. Host owns data flow. Streaming is host-driven: the host
pushes new `pending` props; the mirror holds no connection and runs no
commands.

## Usage

```holo
<TranscriptView turns={@turns} pending={@pending} clearable={@has_store?} />
```

No `cid` needed (stateless); render tests exercise it directly.

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `turns` | `:list` | `[]` | `{id, role, content, created_at, tool_calls?}` snapshots. |
| `load` | `:any` | `nil` | `%{"status" => "ok" | "not_server_backed"}` (Lit `TranscriptLoad`). |
| `pending` | `:string` | `""` | Streaming text not yet finalized into a turn. |
| `clearable` | `:boolean` | `false` | Replaces the Lit `store` object: true → clear affordance renders. |
| `target` | `:string` | `""` | Empty → render-tree default target; else `"page"` / `"layout"` / cid. |
| `class` | `:string` | `""` | Extra classes on the `.tk` root. |

## Event contract

| Lit event | Mirror action | Params |
|---|---|---|
| `tobor-transcript-clear` | `:tobor_transcript_clear` | (none) |

With `target` empty the clear button relies on the render-tree default
(the nearest stateful component — the host, or the wrapping ChatThread when
composed, which is exactly the Lit relay). With an explicit target the
action dispatches there.

## Theming

| Token | Default |
|---|---|
| `--tobor-kit-transcript-height` | `360px` |

## Test hooks

The Lit source uses `data-testid` (registry.yaml defines no `cy:` list for
this tag); those hooks are carried verbatim: `not-server-backed`,
`transcript-empty`, `pending-turn`, `transcript-clear`, `turn-tools`.

## Divergences from the Lit component

1. **`store` prop → `clearable` boolean.** Lit's pluggable store object is
   host-side; the mirror renders the clear affordance from the boolean and
   the host performs the clear.
2. **No `_clearing` transient.** Lit disabled the button during the async
   clear; the host re-renders with `clearable={false}` if it needs the same
   affordance.
3. **`"parent"` is not a runtime-resolvable explicit target** in Hologram
   0.10 (valid: `"page"`, `"layout"`, cid). Empty `target` = render-tree
   default, which *is* the containing stateful component — the contract's
   "parent" semantics. Flagged for `docs/PORTING.md` revision (frozen doc —
   reported, not edited).
