# llm-inference family — Hologram mirror (p2, group B)

Mirror of `web/src/components/llm-inference/` (`tobor-llm-inference` +
`catalog.ts`). **Not in `web/registry.yaml`** — the `data-testid` contract
comes verbatim from the Lit source (PORTING.md §5 registry-gap policy).
Contract: `docs/PORTING.md` §1 (class B + commands), §6.9 (one-shot), §9;
tokens: `docs/THEMING.md`.

## Modules

| Lit file | Mirror | Role |
|---|---|---|
| `catalog.ts` | `ToborKit.Hologram.LlmInference.Catalog` | compile-time provider catalog + pure helpers (transpiles client-side; public data only) |
| `llm-inference.ts` | `ToborKit.Hologram.LlmInference.Settings` | class B + commands (provider switch, model fetch, Test Connection) |

## Usage

```holo
<Settings
  cid="my-llm"
  config={%{"providerID" => "openai", "model" => "gpt-4o"}}
  target="page"
/>
```

`config` uses the Lit JSON spelling, string-keyed: `providerID`, `baseURL`,
`apiKey`, `model`, `apiShape`. The host owns storage; edits arrive as
`config-change` → `:config_change` `%{config}` forwarded to `:target`.
Provider switching replays the Lit state machine (None clears; Z.ai pins
`glm-5.3-flash` + coding-plan base URL; env-key specs re-target).

## Modality (media providers)

`group` says where a provider runs; the optional `:modalities` key on a
provider map says what it produces (`"text"`, `"image"`, `"audio"`,
`"speech"`, `"video"` — `Catalog.modalities/0`). Absent / `nil` / `[]`
means `["text"]`, so the built-in catalog and every existing host render
exactly as before.

| Prop | Default | Role |
|---|---|---|
| `providers` | `[]` (built-in catalog) | host catalog — the Lit `catalog` property's mirror |
| `modality` | `""` (no filter) | only providers producing it are offered |
| `section_by` | `"group"` | picker sectioning axis: `"group"` (Cloud / Proxies & Local / Advanced) or `"modality"` (Text / Image / Audio / Speech / Video) |

```holo
<Settings cid="media-llm" providers={@media_catalog} section_by="modality" />
```

Helpers: `Catalog.provider_modalities/1`, `Catalog.provider_supports?/2`,
`Catalog.providers_by_modality/1,2`, `Catalog.catalog_modalities/1`,
`Catalog.catalog_declares_modalities?/1`, `Catalog.modality_label/1`,
`Catalog.modality_section_title/1`, `Settings.visible_catalog/2`.

## Command contract

| Command | Params | Result actions |
|---|---|---|
| `:test_connection` | `%{config, prompt, transport}` | `:test_ok %{content, model}` \| `:test_failed %{error}` |
| `:fetch_models` | `%{config, transport}` | `:models_loaded %{models}` \| `:models_failed %{error}` |

Wire shapes (Lit parity): openai → `POST {base}/chat/completions`;
anthropic → `POST {base}/messages` with `x-api-key` +
`anthropic-version: 2023-06-01`; models via `GET {base}/models`.

Required HostConfig scope: **`:llm_providers`** —
`%{provider => %{base_url, api_key}}` (atom or string provider keys;
`api_key` accepts a binary, `%{env: "VAR_NAME"}`, or `%{literal: "..."}`;
env specs resolve via `System.get_env/1` at call time).

```elixir
config :tobor_kit_hologram, :host_config,
  llm_providers: [
    openai: [api_key: [env: "OPENAI_API_KEY"]],
    litellm: [base_url: "https://inference.noizu.com/v1", api_key: [env: "LITELLM_API_KEY"]]
  ]
```

## Events

* `config-change` → `:config_change` `%{config}` (every user edit)
* `test-complete` → `:test_complete` `%{ok: true, content}` | `%{ok: false, error}`

## Transport seam + security model (divergences)

* Lit took an injectable `fetch` transport and carried
  `{literal: key}` inside the config. The mirror's seam is **HostConfig +
  optional `:transport` prop** — a module NAME string whose `call/4`
  mirrors `Support.Http` outcomes (see
  `ToborKit.Hologram.TestSupport.LlmTransportStub`). Empty string →
  `Support.Http` (real network). Commands NEVER accept keys as params
  (`from_params!/1` + the config's `apiKey` field is ignored server-side).
* The API Key form field renders as a **hint row** (env-var name only) —
  keys are entered in the host environment, not the component.
* Keys are never logged and never returned; `test-complete` carries
  content or an error message only. Errors name the env VAR, never a value.

## Test hooks

Lit-source testids, verbatim: `llm-header`, `status-badge`, `provider`,
`api-type`, `key-hint` (mirror-renamed from the Lit key input — which the
mirror renders as a hint), `base-url`, `fetch-models`, `model-select`,
`model-text`, `models-error`, `test-connection`, `test-prompt`,
`test-button`, `test-error`, `test-response`.
