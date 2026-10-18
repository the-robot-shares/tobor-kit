# mode-toggle mirror (wave 1)

Mirror of `web/src/components/mode-toggle/mode-toggle.ts` — contract
class B (stateful interactive). Module: `ToborKit.Hologram.ModeToggle.Toggle`.

**Embed with a `cid`** — without it the Hologram renderer treats the
component as stateless and `init/3` never runs.

## Usage

```holo
<ModeToggle.Toggle
  cid="guide-mode"
  modes={["voice", "text", "transcript"]}
  mode="text"
  target="parent"
/>
```

## Props (init snapshot)

| Prop | Type | Default | Notes |
|---|---|---|---|
| `modes` | list | `["text"]` | display order; non-string items drop |
| `mode` | string | `"text"` | initial mode |
| `disabled` | boolean | `false` | disables the whole group |
| `target` | string | `parent` | notification target |
| `class` | string | `""` | extra root class |

## Event/action contract

| Lit event (verbatim) | Mirror action | Params |
|---|---|---|
| `tobor-mode-change` | `:tobor_mode_change` | `%{mode, previous}` |

Local action `:select` (bound on the mode buttons) guards no-ops
(disabled or already-active), updates local state, then forwards
`:tobor_mode_change` to `:target` via `put_action`.

The active button is `aria-checked="true"` **and disabled** (Lit parity).

## Theming

`.tk-mode-toggle__group` radiogroup pill + `.tk-mode-toggle__mode` buttons;
active styling rides the shared `.tk button[aria-checked="true"]` rule.

## data-cy (registry.yaml)

`tobor-mode-toggle` has a `cy_prefix: mode` but **no `cy:` entries** in the
registry — the mirror therefore renders no `data-cy` hooks (contract: hooks
are never invented). Locate via `role="radio"` / `data-mode` in tests.

## Divergences from Lit

- Lit `modes` is a JS-only `GuideMode[]` property; the mirror takes a list
  of strings. Known modes get labels (`Voice`/`Text`/`Transcript`);
  unknown strings render raw (same as Lit `MODE_LABELS[m] ?? m`).

Backend: None. Host owns the conversation mode.
