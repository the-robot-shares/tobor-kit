# tobor-kit Hologram mirrors

Native Elixir [Hologram](https://hologram.page) mirrors of the tobor-kit Lit
web components (`../web/src/components/`). Phase 1 covers presentational
components; server-coupled families stay Lit-side.

* **Interface contract (frozen):** [`docs/PORTING.md`](docs/PORTING.md)
* **Theming + token translation:** [`docs/THEMING.md`](docs/THEMING.md)
* **Test contract:** `data-cy` hooks are copied verbatim from
  `../web/registry.yaml`; mirrors never invent hooks and never modify `web/`.

## Install

Add the dependency to a host Phoenix/Hologram app (path form for local work,
git form otherwise):

```elixir
{:tobor_kit_hologram, path: "../tobor-kit/hologram"}
```

The host must also depend on `:hologram` itself and run its compiler. The library
never does either, because it is not a Hologram app:

```elixir
compilers: Mix.compilers() ++ [:hologram],
deps: [{:hologram, "~> 0.10.0"}, {:tobor_kit_hologram, path: "../tobor-kit/hologram"}]
```

The library declares `{:hologram, runtime: false}`. In a release, Mix is absent, so
`Hologram.Reflection.otp_app/0` picks the one loaded application whose `applications`
list includes `:hologram`. When the library listed it too, the host crashed at boot
with `{badmatch, [:tobor_kit_hologram, host]}` (hologram 0.1.1 fixes this). The host's
Hologram compiler walks every loaded app, so it builds the library's components into
the host bundles. `fixtures/consumer_app` is a minimal host that the suite
compiles, releases and boots (`mix test --only consumer_app`).

Then install the stylesheet:

```bash
mix deps.get && mix tobor_kit_hologram.install
# → priv/static/css/tobor-kit.css
```

and link it from the host layout:

```html
<link rel="stylesheet" href="/css/tobor-kit.css" />
```

## Layout

```
lib/tobor_kit/hologram.ex            facade + Lit-tag → mirror-module index
lib/…/support/{classes,theme,events} shared helpers + frozen event contract
lib/…/data/{dial_codes,plans}        ported data tables (phone-input, plan-compare)
assets/css/tobor-kit.css             light-DOM translation of theme.ts (source)
priv/static/tobor-kit.css            built stylesheet (install-task artifact)
test/                                logic tests + conn-based render tests + gallery
```

## Theming

Every mirror renders a light-DOM root `<div class="tk tk-<name>">` and is
styled exclusively through the `--tobor-kit-*` tokens. Hosts theme by
setting tokens on an ancestor, or by interpolating
`ToborKit.Hologram.Support.Theme.apply_theme_vars/2` output into the root
element's `style` attr. See `docs/THEMING.md`.

## Events

Lit `CustomEvent`s are replaced by host-side actions — names verbatim
(`persona-select` → action `:persona_select`), params snake_cased
(`%{persona_id: …}`). The contract is recorded in
`ToborKit.Hologram.Support.Events` and `docs/PORTING.md` §2.

## Host config (server-coupled mirrors)

Hologram props/state are client-side — endpoints and API keys are resolved
SERVER-side in `command/3` handlers via `ToborKit.Hologram.HostConfig`.
Hosts configure the scopes (`:tobor_kit_api`, `:llm_providers`,
`:waitlist_api`, `:catalog`) through Application env:

```elixir
# host app config/runtime.exs — default Env implementation
config :tobor_kit_hologram, :host_config,
  tobor_kit_api: [
    base_url: System.fetch_env!("TOBOR_KIT_API_URL"),
    token: System.fetch_env!("TOBOR_KIT_API_TOKEN")
  ],
  llm_providers: [
    openai: [
      base_url: "https://api.openai.com/v1",
      api_key_spec: {:env, "OPENAI_API_KEY"}
    ]
  ],
  waitlist_api: [
    base_url: System.fetch_env!("WAITLIST_API_URL"),
    token: System.fetch_env!("WAITLIST_API_TOKEN")
  ],
  catalog: [
    base_url: System.fetch_env!("CATALOG_URL")
  ]
```

Or plug in a custom implementation:

```elixir
config :tobor_kit_hologram, :host_config_module, MyApp.HostConfig
```

Command params arriving from the client are guarded — `HostConfig.from_params!/1`
raises if a param key collides with a reserved secret name
(`base_url`, `token`, `api_key`, `api_key_spec`, `authorization`). See
`docs/PORTING.md` §9.


## Development

```bash
mix compile   # hologram compiler runs as part of Mix.compilers()
mix test      # logic + conn-based gallery render tests
```

First compile installs the hologram JS toolchain (esbuild via npm) — expect
a one-time network fetch. No server is started by the test suite; client-
runtime behavior is browser-verified at integration time (PORTING.md §6.4).
