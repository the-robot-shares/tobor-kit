# telemetry-toggle mirror (phase 2, group A)

Mirror of `web/src/components/telemetry-toggle/telemetry-toggle.ts` —
contract class B + commands (PORTING.md §6.7). Module:
`ToborKit.Hologram.Telemetry.Toggle`.

**Embed with a `cid`** — without it the Hologram renderer treats the
component as stateless and `init/3` never runs.

## Usage

```holo
<Telemetry.Toggle cid="telemetry" target="page" />
```

Host wiring (Application env, `config/runtime.exs` of the host app):

```elixir
config :tobor_kit_hologram, :host_config,
  tobor_kit_api: %{
    base_url: "https://guide.example.com",
    token: System.fetch_env!("TOBOR_KIT_API_TOKEN")
  }
```

## Props (init snapshot)

| Prop | Type | Default | Notes |
|---|---|---|---|
| `consent` | map | nil | host-fetched consent snapshot; renders without any API access (Lit parity) |
| `target` | string | `parent` | notification target |
| `class` | string | `""` | extra root class |

## Command contract

| Command | HTTP (server-side) | Result action |
|---|---|---|
| `:load_consent` | `GET {base_url}/telemetry/consent` via `HostConfig.resolve(:tobor_kit_api)` | `:consent_loaded %{consent}` / `:consent_error %{message}` |
| `:set_consent` | `PUT {base_url}/telemetry/consent` body `%{enabled}` | `:consent_saved %{consent}` / `:consent_forbidden %{enabled}` (403) / `:consent_error %{message}` |

Both commands run `HostConfig.from_params!/1` (reserved secret keys are
denied at the door) and resolve the endpoint + bearer token server-side via
`HostConfig.resolve(:tobor_kit_api)`. The scope map may carry a `transport`
key (module with `get/2`/`put/3` matching `Support.Http`'s outcome shape) —
tests and the gallery inject a stub there; production falls through to
`ToborKit.Hologram.Support.Http`.

## Render states (Lit parity)

* consent known + overridable — checkbox (`data-testid="telemetry-toggle"`)
* consent known but `source: "forced"` / `user_overridable: false` — **renders nothing**
* load error — `.notice--error` (`data-testid="telemetry-error"`)
* otherwise (loading / no data path) — nothing

A 403 on PUT marks the stored consent forced: the toggle disappears and
`tobor-telemetry-change` fires with the forced consent.

## Event/action contract

| Lit event (verbatim) | Mirror action | Params |
|---|---|---|
| `tobor-telemetry-change` | `:tobor_telemetry_change` | `%{consent: map}` |

`consent` maps are normalized to atom keys `%{enabled, source, user_overridable}`
both for host props and HTTP bodies.

## Theming

`.tk-telemetry-toggle__label` (muted, 0.85em, checkbox with `--tk-accent`
accent). No extra vars.

## data-cy / test hooks

`tobor-telemetry-toggle` has a `cy_prefix: telemetry` but **no `cy:` entries**
in the registry — the mirror keeps the Lit source's `data-testid` attributes
verbatim: `telemetry-toggle`, `telemetry-error`.

## Divergences from Lit

- **No mount-time auto-fetch.** Hologram has no load event; the initial GET
  fires only from a command. Hosts either pass the `consent` prop (host
  fetches through its own API — the cookie-family "host owns the truth"
  pattern) or trigger `:load_consent` from host-authored trigger content
  targeted at the mirror's cid, e.g.

  ```holo
  <Telemetry.Toggle cid="telemetry">
    <button $click={command: :load_consent, target: "telemetry"}>Load</button>
  </Telemetry.Toggle>
  ```

- The client does not keep an optimistic checked-echo while saving; the
  checkbox is disabled during the round-trip and updates on the result.

Backend: `:tobor_kit_api` HostConfig scope (`%{base_url, token}`; optional
`transport` injection key). Never called from `init/3` or the client.
