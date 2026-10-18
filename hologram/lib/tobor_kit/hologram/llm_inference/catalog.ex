defmodule ToborKit.Hologram.LlmInference.Catalog do
  @moduledoc """
  Provider catalog for the `llm-inference` mirror — ported 1:1 from the Lit
  `web/src/components/llm-inference/catalog.ts` (itself the TS twin of
  `swift/LLMProvider.swift`).

  Compile-time data + pure helpers. Everything here is PUBLIC information
  (provider labels, default base URLs, env-var NAMES — never values), so the
  module transpiles into the client bundle for template use AND runs
  server-side inside `Settings.command/3`.

  Config maps use the Lit JSON spelling, string-keyed:
  `%{"providerID" => ..., "baseURL" => ..., "apiKey" => ..., "model" => ..., "apiShape" => ...}`.
  Mirror divergence: the `apiKey` field of the config is **ignored by every
  command** — keys resolve server-side via `ToborKit.Hologram.HostConfig`
  scope `:llm_providers` at call time and never ride props/params/state.
  """

  @type provider :: %{
          required(:id) => String.t(),
          required(:label) => String.t(),
          required(:group) => String.t(),
          required(:api_shape) => String.t() | nil,
          required(:default_base_url) => String.t() | nil,
          required(:base_url_placeholder) => String.t() | nil,
          required(:env_var_name) => String.t() | nil,
          required(:requires_key) => boolean,
          required(:default_model) => String.t() | nil,
          optional(:modalities) => [String.t()] | nil
        }

  @typedoc """
  What a provider *produces* — orthogonal to `:group` (where it runs).
  Absent / nil / empty on a provider means `["text"]`, so pre-modality
  catalogs behave exactly as before.
  """
  @type modality :: String.t()

  # Lit `LLM_PROVIDER_CATALOG`, verbatim.
  @catalog [
    # ── Cloud Providers ──
    %{
      id: "anthropic",
      label: "Anthropic (Claude)",
      group: "cloud",
      api_shape: "anthropic",
      default_base_url: "https://api.anthropic.com/v1",
      base_url_placeholder: nil,
      env_var_name: "ANTHROPIC_API_KEY",
      requires_key: true,
      default_model: "claude-sonnet-4-20250514"
    },
    %{
      id: "openai",
      label: "OpenAI",
      group: "cloud",
      api_shape: "openai",
      default_base_url: "https://api.openai.com/v1",
      base_url_placeholder: nil,
      env_var_name: "OPENAI_API_KEY",
      requires_key: true,
      default_model: "gpt-4o"
    },
    %{
      id: "deepseek",
      label: "DeepSeek",
      group: "cloud",
      api_shape: "openai",
      default_base_url: "https://api.deepseek.com/v1",
      base_url_placeholder: nil,
      env_var_name: "DEEPSEEK_API_KEY",
      requires_key: true,
      default_model: "deepseek-chat"
    },
    %{
      id: "groq",
      label: "Groq",
      group: "cloud",
      api_shape: "openai",
      default_base_url: "https://api.groq.com/openai/v1",
      base_url_placeholder: nil,
      env_var_name: "GROQ_API_KEY",
      requires_key: true,
      default_model: "llama-3.3-70b"
    },
    %{
      id: "cerebras",
      label: "Cerebras",
      group: "cloud",
      api_shape: "openai",
      default_base_url: "https://api.cerebras.ai/v1",
      base_url_placeholder: nil,
      env_var_name: "CEREBRAS_API_KEY",
      requires_key: true,
      default_model: "llama-3.3-70b"
    },
    %{
      id: "zai",
      label: "Z.ai (Zhipu/GLM)",
      group: "cloud",
      api_shape: "openai",
      default_base_url: "https://api.z.ai/api/coding/paas/v4",
      base_url_placeholder: "https://api.z.ai/api/coding/paas/v4",
      env_var_name: "ZAI_API_KEY",
      requires_key: true,
      default_model: "glm-5.3-flash"
    },
    # ── Proxies & Local ──
    %{
      id: "litellm",
      label: "LiteLLM Proxy",
      group: "proxyLocal",
      api_shape: "openai",
      default_base_url: "https://inference.noizu.com/v1",
      base_url_placeholder: "https://inference.noizu.com/v1",
      env_var_name: "LITELLM_API_KEY",
      requires_key: true,
      default_model: "claude-sonnet-4-6"
    },
    %{
      id: "ollama",
      label: "Ollama (Local)",
      group: "proxyLocal",
      api_shape: "openai",
      default_base_url: "http://localhost:11434",
      base_url_placeholder: "http://localhost:11434",
      env_var_name: nil,
      requires_key: false,
      default_model: "llama3"
    },
    # ── Advanced ──
    %{
      id: "custom",
      label: "Custom Endpoint",
      group: "advanced",
      api_shape: nil,
      default_base_url: nil,
      base_url_placeholder: "https://api.example.com/v1",
      env_var_name: nil,
      requires_key: true,
      default_model: "model-name"
    }
  ]

  # Modality axis (Lit `LLM_MODALITIES` / Swift `LLMModality`).
  @modalities ["text", "image", "audio", "speech", "video"]
  @default_modalities ["text"]

  @doc "All catalog providers, in reference order."
  @spec providers :: [provider]
  def providers, do: @catalog

  @doc "The host list when non-empty, else the built-in catalog (Lit `catalog` prop parity)."
  def catalog_or_default(nil), do: @catalog
  def catalog_or_default([]), do: @catalog
  def catalog_or_default(list) when is_list(list), do: list

  @doc "Providers of one group (`\"cloud\"`, `\"proxyLocal\"`, `\"advanced\"`)."
  def providers_by_group(group), do: providers_by_group(group, @catalog)

  def providers_by_group(group, catalog) do
    Enum.filter(catalog, fn p -> p.group == group end)
  end

  @doc "Lit `providerByID` — `nil` when unknown."
  def provider_by_id(nil), do: nil

  def provider_by_id(id) when is_binary(id), do: provider_by_id(id, @catalog)

  def provider_by_id(nil, _catalog), do: nil

  def provider_by_id(id, catalog) when is_binary(id) do
    Enum.find(catalog, fn p -> p.id == id end)
  end

  # -- modality axis --------------------------------------------------------

  @doc "Canonical modality order (Lit `LLM_MODALITIES`)."
  def modalities, do: @modalities

  @doc "What a descriptor without `:modalities` means."
  def default_modalities, do: @default_modalities

  @doc "Section heading label for a modality (`\"image\"` → `\"Image\"`)."
  def modality_label("text"), do: "Text"
  def modality_label("image"), do: "Image"
  def modality_label("audio"), do: "Audio"
  def modality_label("speech"), do: "Speech"
  def modality_label("video"), do: "Video"
  def modality_label(other), do: other

  @doc "The disabled section row a modality-sectioned picker renders."
  def modality_section_title(modality), do: "── " <> modality_label(modality) <> " ──"

  @doc "A provider's modalities, defaulted: absent / nil / empty ⇒ `[\"text\"]`."
  def provider_modalities(nil), do: @default_modalities

  def provider_modalities(provider) do
    case Map.get(provider, :modalities) do
      nil -> @default_modalities
      [] -> @default_modalities
      list when is_list(list) -> list
    end
  end

  @doc "Whether a provider produces the given modality (text by default)."
  def provider_supports?(provider, modality) do
    Enum.member?(provider_modalities(provider), modality)
  end

  @doc "Catalog slice for one modality, in catalog order."
  def providers_by_modality(modality), do: providers_by_modality(modality, @catalog)

  def providers_by_modality(modality, catalog) do
    Enum.filter(catalog, fn p -> provider_supports?(p, modality) end)
  end

  @doc "Whether any entry declares modalities — sectioning by them is meaningful."
  def catalog_declares_modalities?(catalog) do
    Enum.any?(catalog, fn p -> (Map.get(p, :modalities) || []) != [] end)
  end

  @doc "Modalities present in a catalog, in canonical order."
  def catalog_modalities(catalog) do
    Enum.filter(@modalities, fn m -> Enum.any?(catalog, fn p -> provider_supports?(p, m) end) end)
  end

  # -- config accessors (string-keyed Lit JSON spelling) --------------------

  @doc "Config `providerID` (empty string when unset)."
  def config_provider_id(config), do: Map.get(config, "providerID") || ""

  @doc "Config `baseURL` override or `nil`."
  def config_base_url(config), do: Map.get(config, "baseURL") || nil

  @doc "Config `model` or `nil`."
  def config_model(config), do: Map.get(config, "model") || nil

  @doc "Config `apiShape` pick (`custom` only) or `nil`."
  def config_api_shape(config), do: Map.get(config, "apiShape") || nil

  @doc "Lit `effectiveAPIShape`: pinned shape wins; the config pick applies to `custom` only; openai fallback."
  def effective_api_shape(config) do
    case provider_by_id(config_provider_id(config)) do
      %{api_shape: shape} when is_binary(shape) -> shape
      _ -> config_api_shape(config) || "openai"
    end
  end

  @doc "Lit `effectiveBaseURL`: config override, else the catalog default, else `nil`."
  def effective_base_url(config) do
    config_base_url(config) ||
      case provider_by_id(config_provider_id(config)) do
        nil -> nil
        p -> p.default_base_url
      end
  end

  @doc "Lit `showsBaseURL`: the Base URL field renders when a placeholder exists."
  def shows_base_url?(nil), do: false

  def shows_base_url?(provider), do: provider.base_url_placeholder != nil

  @doc "Lit `envHint` — the env-var NAME under the key field (never a value)."
  def env_hint(nil), do: nil

  def env_hint(provider) do
    case provider.env_var_name do
      nil -> nil
      name -> "Can also be set via #{name} environment variable."
    end
  end

  @doc "Lit provider-switch preset: Z.ai pins model + coding-plan base URL."
  def zai_preset do
    %{"providerID" => "zai", "model" => "glm-5.3-flash", "baseURL" => "https://api.z.ai/api/coding/paas/v4"}
  end

  # -- response parsing (server-side command use) ---------------------------

  @doc "OpenAI shape: `choices[0].message.content` (empty string when absent)."
  def parse_openai_content(%{"choices" => [first | _]}) do
    get_in(first, ["message", "content"]) || ""
  end

  def parse_openai_content(_), do: ""

  @doc "Anthropic shape: concatenated `text` of the `content` blocks."
  def parse_anthropic_content(%{"content" => blocks}) when is_list(blocks) do
    Enum.map(blocks, fn b -> Map.get(b, "text") || "" end)
    |> Enum.join("")
  end

  def parse_anthropic_content(_), do: ""

  @doc "Echoed `model` field or the fallback the request used."
  def response_model(%{"model" => model}, _fallback) when is_binary(model), do: model
  def response_model(_, fallback), do: fallback
end
