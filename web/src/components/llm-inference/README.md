# llm-inference

The **LLM Inference** pod — the direct-provider inference settings surface,
a 1:1 port of llm-toolkit's Settings page LLM section
(`Portfolio/Apps/AI/llm-toolkit/packages/web/src/pages/Settings.tsx`,
"LLM Inference"). Lit element `tobor-llm-inference` (`llm-inference.ts`) and
the Swift mirror (`swift/`) implement the identical flow — docs/
SWIFT-CONVENTIONS.md governs the mirror pair. It **complements**
`../model-config/` — that one models the host-app model-config schema; this
one models direct provider inference config.

## The flow (llm-toolkit is authoritative)

1. **Header row** — "LLM Inference" + status badge: green
   `<provider> connected` once a provider is selected, yellow
   `Not configured` otherwise. Availability state only — never a test
   round-trip result.
2. **Provider** — None / ── Cloud Providers ── (Anthropic, OpenAI, DeepSeek,
   Groq, Cerebras, Z.ai) / ── Proxies & Local ── (LiteLLM Proxy, Ollama
   (Local)) / ── Advanced ── (Custom Endpoint). The switch state machine:
   None clears the whole config; **Z.ai presets model `glm-5.3-flash` +
   coding-plan base URL** `https://api.z.ai/api/coding/paas/v4`; every other
   provider keeps only the API key and drops model / base URL / API type;
   the fetched model list clears.
3. **API Type** — only for Custom Endpoint (OpenAI-compatible vs
   Anthropic-compatible).
4. **API Key** — masked, placeholder "Enter API key (or set via environment
   variable)", env-var hint ("Can also be set via ZAI_API_KEY environment
   variable.") when the provider has one. Keys are never logged; env specs
   resolve at call time.
5. **Base URL** — inline (no disclosure), only for Ollama / LiteLLM /
   Custom / Z.ai, with per-provider placeholders. Blank = provider default.
6. **Model** — label row with a trailing "Fetch models" / "Refresh models"
   link. Before the first fetch: free-text field with the per-provider
   placeholder. After: a picker with a "Default (…)" option plus a free-text
   custom entry, and the "N models available. Select from list or type a
   custom name." caption.
7. **Test Connection** — boxed section: prompt field (Enter submits, default
   "Say hello in one sentence"), Test button ("Sending..." while in flight),
   error box, response box ("Response:"), footer hint.

## Types

| Type | Role |
|---|---|
| `LLMProvider` / `LLM_PROVIDER_CATALOG` | Provider catalog: id, label, picker group, API shape, default base URL, base-URL placeholder, env var name, default model placeholder. |
| `LLMModality` / `LLMModalities` | The modality axis: `text` \| `image` \| `audio` \| `speech` \| `video`. **Optional** on the provider descriptor — absent / null / empty means `["text"]`. Orthogonal to the picker `group` (deployment location), which is unchanged. |
| `LLMApiShape` | `openai` (`POST {base}/chat/completions`) or `anthropic` (`POST {base}/messages`). |
| `LLMKeySpec` / `{env}\|{literal}` | `.environment(name)` (resolved at call time) or `.literal(String)`. Never logged. |
| `LLMInferenceConfig` / `LLMInferenceConfigData` | Persisted settings: provider, URL override, key spec, model, API type (custom). |
| `LLMInferenceConfigStoring` | Swift storage protocol; `UserDefaultsLLMInferenceConfigStore` is the defaults impl. |
| `LLMInferenceClient` | Non-streaming completions + `GET {base}/models` listing — over `ToborKitCore.HTTPTransporting` (Swift) or a fetch-shaped `transport` prop (Lit). |
| `LLMInferenceSettingsView` / `tobor-llm-inference` | The settings UI above. Events (Lit): `config-change` `{config}`, `test-complete` `{ok, content?, error?}`. |

## Providers

| id | base URL | shape | env var | model placeholder |
|---|---|---|---|---|
| `anthropic` | `https://api.anthropic.com/v1` | anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| `openai` | `https://api.openai.com/v1` | openai | `OPENAI_API_KEY` | `gpt-4o` |
| `deepseek` | `https://api.deepseek.com/v1` | openai | `DEEPSEEK_API_KEY` | `deepseek-chat` |
| `groq` | `https://api.groq.com/openai/v1` | openai | `GROQ_API_KEY` | `llama-3.3-70b` |
| `cerebras` | `https://api.cerebras.ai/v1` | openai | `CEREBRAS_API_KEY` | `llama-3.3-70b` |
| `zai` | `https://api.z.ai/api/coding/paas/v4` | openai | `ZAI_API_KEY` | `glm-5.3-flash` |
| `litellm` | `https://inference.noizu.com/v1` | openai | `LITELLM_API_KEY` | `claude-sonnet-4-6` |
| `ollama` | `http://localhost:11434` | openai | — | `llama3` |
| `custom` | user URL | user-picked | — | `model-name` |

Z.ai's coding-plan endpoint is the preset (llm-toolkit's selection branch
stores it into the config on switch). Z.ai may not implement `GET /models` —
the error surfaces and the free-text model entry stays the path in.

Hosts wanting no key at rest should only ever build `.environment` specs
and keep `LLMInferenceConfig.apiKey` env-based.

## Modality (media providers)

`group` says **where** a provider runs (cloud / proxyLocal / advanced);
`modalities` says **what it produces**. They are independent axes — a
media host (image / audio / speech / video providers) declares
`modalities` on its catalog entries instead of wrapping `LLMProvider`
locally.

The field is optional everywhere and defaults to `["text"]`, so the
built-in catalog above (which declares nothing) and every existing
consumer behave exactly as before, and a stored payload with no
`modalities` key round-trips untouched.

| Mirror | Type | Descriptor field | Settings surface |
|---|---|---|---|
| Lit / TS | `LLMModality` (`"text" \| "image" \| "audio" \| "speech" \| "video"`) | `LLMProviderData.modalities?: LLMModality[] \| null` | `modality` property (filter) + `section-by="modality"` attribute (sectioning); default `section-by="group"` |
| Swift | `LLMModality` (`String`-raw, `Codable`, `CaseIterable`) | `LLMProvider.modalities: [LLMModality]?` (init param defaults to `nil`) | `LLMInferenceSettingsView(modality:sectionBy:)`, `SectionAxis.group` default |
| Hologram / Elixir | modality strings + `Catalog.modalities/0` | `:modalities` key on a provider map (optional) | `modality` + `section_by` props (and the `providers` host-catalog prop) |

Helpers, one per mirror name: `providerModalities` / `effectiveModalities`
/ `Catalog.provider_modalities`, `providerSupportsModality` / `supports(_:)`
/ `Catalog.provider_supports?`, `providersByModality` /
`LLMProvider.providers(in:matching:)` / `Catalog.providers_by_modality`,
`catalogModalities` / `LLMProvider.modalities(in:)` /
`Catalog.catalog_modalities`.

```ts
const mediaCatalog: LLMProviderData[] = [
  { ...openai, modalities: ["text", "image"] },
  { ...suno, modalities: ["audio"] },
];
html`<tobor-llm-inference .catalog=${mediaCatalog} section-by="modality"></tobor-llm-inference>`;
// or: filter to one modality, keeping the group sections
html`<tobor-llm-inference .catalog=${mediaCatalog} modality="audio"></tobor-llm-inference>`;
```
