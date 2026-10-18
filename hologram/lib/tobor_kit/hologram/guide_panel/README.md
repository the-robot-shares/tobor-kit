# guide-panel family — Hologram mirror (p2, group B)

Mirror of `web/src/components/guide-panel/` (`tobor-guide-panel`). Contract:
`docs/PORTING.md` §1 (class B + commands), §6.9 (one-shot degradation), §9;
tokens: `docs/THEMING.md`.

## Module

| Lit tag | Mirror | Class |
|---|---|---|
| `tobor-guide-panel` | `ToborKit.Hologram.GuidePanel.Panel` | B + commands |

## Usage

```holo
# snapshot path (prop wins — host owns the data flow)
<GuidePanel cid="my-panel" guide={@guide_projection} placement="inline" target="page" />

# fetch path (HostConfig-resolved GET /guide on mount)
<GuidePanel cid="my-panel" auto_fetch={true} target="page" />

# Lit-parity attrs path (token client-visible by design — see security note)
<GuidePanel cid="my-panel" auto_fetch={true} base_url="https://api.test/tobor-kit" token="…" />
```

`guide` is the `GET /guide` projection, **string-keyed** (template-literal
shape). `placement` clamps to `floating | docked | inline`.

## Command contract

| Command | Params | Result actions |
|---|---|---|
| `:fetch_guide` | `%{}` (HostConfig `:tobor_kit_api`) | `:guide_loaded %{guide}` \| `:guide_error %{error}` |
| `:fetch_guide_remote` | `%{base_url, token}` — documented `from_params!/1` exception (Lit parity attrs) | same |
| `:fetch_inventory` | `%{}` or `%{base_url, token}` | `:inventory_loaded %{inventory}` \| `:inventory_error` |
| `:submit_turn` | `%{input, task_id, session_id}` | `:turn_completed %{turn, session_id}` \| `:turn_error %{error}` |

Required HostConfig scope: `:tobor_kit_api` (`%{base_url, token}`).

```elixir
config :tobor_kit_hologram, :host_config,
  tobor_kit_api: [
    base_url: System.fetch_env!("TOBOR_KIT_API_URL"),
    token: System.fetch_env!("TOBOR_KIT_API_TOKEN")
  ]
```

## Turn flow — v1 one-shot degradation (PORTING.md §6.9)

Lit streams SSE deltas; Hologram commands are one-shot. v1 renders **final
turns only**: submit → `:submit_turn` (ensure session via `POST /sessions`
→ `POST /sessions/{id}/turn`) → single result action. The command accepts
a plain JSON turn OR an SSE body (terminal `message` frame extracted
server-side; missing terminal → `stream_incomplete`, matching
`client.ts`). **No pending-bubble UI, no `tobor-state-change` emissions**
— hosts get `tobor-turn-submitted` at submit and `tobor-turn-message` /
`tobor-turn-error` at completion. The v2 streaming lane
(`put_subscription` + `Realtime.broadcast_action`) is recorded in §6.9,
not built.

## Events (registry-verbatim → action atoms, forwarded to `:target`)

* `tobor-task-invoked` → `:tobor_task_invoked` `%{task_id}`
* `tobor-turn-submitted` → `:tobor_turn_submitted` `%{input, task_id}`
* `tobor-turn-message` → `:tobor_turn_message` `%{turn: %{id, role, content, created_at, tool_calls}}`
* `tobor-turn-error` → `:tobor_turn_error` `%{error: %{code, message}}`
* `tobor-state-change` → not emitted in v1 (see degradation above)

## State machine

Canonical 7 GuideState values (`clamp_state/1`): `idle | listening |
thinking | speaking | tool_running | error | offline`. v1 transitions:
`idle → thinking` (submit) `→ idle | error`.

## Composition + divergences

* Embeds the phase-1 mirrors with derived child cids:
  `<Avatar cid="{@cid}-avatar">`, `<Menu cid="{@cid}-tasks" target={@cid}>`,
  `<List cid="{@cid}-tools" target={@cid}>`,
  `<Toggle cid="{@cid}-mode" target={@cid}>`,
  `<View clearable target={@cid}>` — their forwarded actions land on the
  panel's `action/3`.
* **voice-session has no mirror** — voice mode renders a placeholder
  (`data-testid="voice-unavailable"`).
* **telemetry-toggle has no mirror in this worktree** (phase-2 sibling) —
  the footer carries only expand/collapse.
* No fixed-positioning logic for `placement="floating"` — the host page
  owns layout; the class sets max-width only.

## Security notes

* `:fetch_guide` / `:submit_turn` / `:fetch_inventory` guard with
  `HostConfig.from_params!/1` and resolve tokens server-side.
* The `base_url`/`token` attrs path is the ONE documented guard exception:
  those attrs are the Lit-documented public surface (same exposure as the
  Lit element). HostConfig remains the secret-safe path.

## Test hooks

Lit-source testids, verbatim: `panel-error`, `panel-loading`,
`tools-toggle`, `greeting`, `turn-error`, `text-input`, `send`,
`collapse`, `expand`, plus mirror-added `voice-unavailable`.
