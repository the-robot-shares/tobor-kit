# Task menu (Hologram mirror)

Port of `web/src/components/task-menu/task-menu.ts` (Lit) →
`ToborKit.Hologram.TaskMenu.Menu`.

## Usage

```elixir
<Menu cid="my-task-menu" inventory={@tool_inventory} open={false} target="page" />
```

`cid` is required (Hologram stateful component). `target` is the host page /
component that receives the dispatched action (class-B contract,
`default: "parent"`).

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `inventory` | string-keyed map (`groups`/`tools`/`degraded`) | `Data.Tools.empty_inventory()` | normalized in `init/3` |
| `open` | boolean | `false` | initial open state |
| `target` | string | `"parent"` | action dispatch target |

## Event contract

| Lit `CustomEvent` | Hologram action | Params |
|---|---|---|
| `tobor-task-select` | `:tobor_task_select` | `%{tool: tool}` |

Confirm-capable tools (`confirm: true`) confirm inline first (`Yes`/`No`
buttons, Escape cancels); the host action fires only after confirmation.

## Theming

Scoped under `.tk-task-menu`; uses the shared `.tk-*` token aliases
(`--tk-bg`, `--tk-border`, `--tk-radius`, `--tk-shadow`, …). No
family-specific public tokens.

## data-cy

`web/registry.yaml` declares `cy_prefix: task` but **no `cy:` hooks** for this
tag. The mirror copies the Lit source's `data-testid` attributes verbatim
instead: `task-menu-trigger`, `task-menu-panel`, `task-menu-degraded`,
`task-menu-empty`, `task-menu-confirm`, per-item `data-tool`.

## Divergences

- `data-testid` instead of `data-cy` (registry declares none — see above).
- Escape-to-close uses the compile-time-validated `$key_down.escape` binding.
- Inventory normalization is server-side only (`init/3`); client re-renders
  touch state only.

## Backend

None. Host owns task execution — the mirror only reports the selection
(`:tobor_task_select`) and lets the host act on it.
