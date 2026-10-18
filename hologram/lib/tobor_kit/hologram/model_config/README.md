# model-config mirror (phase 2, group A)

Mirror of `web/src/components/model-config/noizu-model-config.ts` (+ its
`catalog.ts` helpers) — contract class B + commands. Module:
`ToborKit.Hologram.ModelConfig.Config`.

**Embed with a `cid`** — without it the Hologram renderer treats the
component as stateless and `init/3` never runs.

## Usage

```holo
<ModelConfig.Config
  cid="model-config"
  catalog={@catalog_entries}
  value="openai:gpt-5"
  inherit={true}
  allow_custom={true}
  allow_budget={true}
  budget={25.0}
  target="page"
/>
```

Host wiring (only needed when the command fetches without a URL):

```elixir
config :tobor_kit_hologram, :host_config,
  catalog: %{base_url: "https://cat.example.com/model-catalog.json"}
```

## Props (init snapshot)

| Prop | Type | Default | Notes |
|---|---|---|---|
| `catalog` | list | `[]` | host-fetched entries (string- or atom-keyed); wins over loaded entries |
| `catalog_url` | string | `""` | public catalog URL, used by the `:load_catalog` command when invoked with `%{url: ...}` |
| `value` | string | `""` | `provider:model` spec; empty/`inherit` = inherit when `inherit` is on |
| `inherit` | boolean | `false` | include the Inherit option (host owns nearest-ancestor-wins) |
| `allow_custom` | boolean | `false` | custom endpoint fieldset |
| `allow_budget` | boolean | `false` | budget input |
| `budget` | float | nil | current budget (unit is host-owned; pass floats) |
| `custom_endpoint` | map | nil | seeds the endpoint drafts (may include a masked `api_key` echo — never logged) |
| `target` | string | `parent` | notification target |
| `class` | string | `""` | extra root class |

## Command contract

| Command | HTTP (server-side) | Result action |
|---|---|---|
| `:load_catalog` `%{url}` optional | `GET {url}` — or `HostConfig.resolve(:catalog).base_url` when no URL is given | `:catalog_loaded %{entries, custom}` / `:catalog_error %{message}` |

The catalog GET is public data; the URL may ride the params (Lit fetched it
client-side). Bodies are normalized server-side to atom-keyed entries
`%{provider, model, label, spec}`; an optional `custom`/`customEndpoint`/
`custom_endpoint` echo seeds the endpoint drafts. Transport injection: a
`transport` key on the `:catalog` scope map (module matching `Support.Http`'s
outcome shape); unwired scope + public URL falls through to `Support.Http`.

## Event/action contract

| Lit event (verbatim) | Mirror action | Params |
|---|---|---|
| `model-change` | `:model_change` | `%{value}` |
| `custom-endpoint-save` | `:custom_endpoint_save` | `%{base_url, model, api_key, value}` |
| `budget-change` | `:budget_change` | `%{amount}` |

Empty or masked (`••••1234`, `***…`, `xxxx…`) api_key is emitted as `""` —
"keep the stored key"; the host must not overwrite.

## data-cy (registry.yaml)

| Hook | Element |
|---|---|
| `model.picker` | model `<select>` |
| `model.custom` | custom endpoint `<fieldset>` |
| `model.budget` | budget `<input>` |
| `model.save` | "Save endpoint" button |

## Theming

`.tk-model-config__stack/__field/__select/__input/__custom/__save` over the
shared `.tk` tokens (`--tk-surface`, `--tk-border`, `--tk-muted`).

## Divergences from Lit

- **No mount-time auto-fetch.** The catalog loads from the `catalog` prop,
  or via the `:load_catalog` command (host-triggered; no `$load` event in
  Hologram).
- **`budget-change` `amount` is a string** (or `0` for empty input): number
  parsing is not in the verified client op set. The host parses; the unit is
  host-owned anyway.
- `custom-endpoint-save` folds Lit's paired `model-change` into a `value`
  param — §6.9 allows one action per dispatch and the last `put_action`
  would win.
- Masked-key detection is the regex-free shape of `isMaskedSecret` (prefix
  checks for `•`, `***`, `xxxx`, `XXXX`).
- `label` matching skips the Lit trim (values arrive from host data; the
  catalog normalizer strips spaces server-side).
- No `for`/`id` field wiring (instance-scoped ids need the cid, which
  `init/3` cannot see); controls keep their `aria-label`s.

Backend: optional `:catalog` HostConfig scope (`%{base_url}`, optional
`transport`); never called from `init/3`.
