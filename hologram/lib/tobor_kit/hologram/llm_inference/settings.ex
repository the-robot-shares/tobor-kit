defmodule ToborKit.Hologram.LlmInference.Settings do
  @moduledoc """
  Mirror of `<tobor-llm-inference>` (registry: `llm-inference` family is
  NOT in `web/registry.yaml` — the `data-testid` contract comes verbatim
  from the Lit source per the PORTING.md §5 registry-gap policy). A port
  of llm-toolkit's Settings page LLM section: header + status badge,
  provider picker, API type (custom), key/env hint, base URL, model
  fetch/pick, Test Connection box. Contract class B **plus server
  commands** (PORTING.md §6.7/§9).

  Lit surface → mirror surface:

    * `config` JS property → string-keyed `:map` prop (Lit JSON spelling:
      `providerID`/`baseURL`/`apiKey`/`model`/`apiShape`). The host owns
      storage; edits come back as the `config-change` event → action
      `:config_change` `%{config: ...}` forwarded to `:target`.
    * Provider-switch state machine (Lit `onProviderChange`): switching
      clears the model list; None clears the config; Z.ai presets
      `glm-5.3-flash` + the coding-plan base URL; env-key specs re-target
      the new provider's env var.
    * `test-complete` event → action `:test_complete`
      `%{ok: boolean, content | error}`.
    * Base URL / model / API-type inputs drive `:config_change` exactly
      like Lit's `@input` handlers.
    * `providers` / `modality` / `section_by` props mirror the Lit
      `catalog` / `modality` / `section-by` properties: an optional host
      catalog, an optional modality filter, and the picker's sectioning
      axis ("group" — the historic Cloud / Proxies & Local / Advanced
      headings — or "modality"). Providers that declare no `:modalities`
      are `["text"]`, so untouched hosts render exactly as before.

  ## Divergences (security model)

    * **API keys never enter props, params, or state.** The Lit version
      carried `{literal: key}` inside the config and took an injectable
      fetch transport. The mirror's seam is
      `HostConfig.resolve(:llm_providers)` — `%{provider => %{base_url,
      api_key}}` (atom or string provider keys; `api_key` accepts a
      binary, `%{env: "VAR"}`, or `%{literal: "..."}`) resolved at command
      time — plus an optional `:transport` prop for tests/gallery (a
      module NAME string; its `call/4` mirrors `Support.Http` outcomes).
      The API Key form field therefore renders as a **hint row** (env-var
      name only), not an input. Commands ignore any `apiKey` field inside
      the config map.
    * Keys are never logged and never returned — `:test_complete` carries
      content or an error message only.
    * Model fetching (`GET {base}/models`) stays, via the same seam.

  ## Commands (one-shot, PORTING.md §6.9)

    * `:fetch_models` `%{config, transport}` → `:models_loaded
      %{models}` | `:models_failed %{error}`
    * `:test_connection` `%{config, prompt, transport}` → `:test_ok
      %{content, model}` | `:test_failed %{error}`

  Wire shapes: openai → `POST {base}/chat/completions`; anthropic →
  `POST {base}/messages` with `x-api-key` + `anthropic-version` headers;
  everything else `Authorization: Bearer`.
  """

  use Hologram.Component

  alias ToborKit.Hologram.HostConfig
  alias ToborKit.Hologram.LlmInference.Catalog
  alias ToborKit.Hologram.Support.Classes
  alias ToborKit.Hologram.Support.Http

  prop :config, :map, default: %{}
  prop :transport, :string, default: ""
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""
  # Host-supplied provider catalog (Lit `catalog` prop parity); [] = built-in.
  prop :providers, :list, default: []
  # Optional modality filter ("" = the whole catalog, as before).
  prop :modality, :string, default: ""
  # Provider-picker sectioning axis: "group" (default) or "modality".
  prop :section_by, :string, default: "group"

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-llm-inference", @class)}>
      <div class="tk-llm-inference__header" data-testid="llm-header">
        <h2 class="tk-llm-inference__heading">LLM Inference</h2>
        {%if provider_id(@config) != ""}
          <span class="tk-llm-inference__badge tk-llm-inference__badge--ok" data-testid="status-badge">
            <span class="tk-llm-inference__dot"></span>{provider_id(@config)} connected
          </span>
        {%else}
          <span class="tk-llm-inference__badge tk-llm-inference__badge--warn" data-testid="status-badge">
            <span class="tk-llm-inference__dot"></span>Not configured
          </span>
        {/if}
      </div>

      <div class="tk-llm-inference__field">
        <label class="tk-llm-inference__label">Provider</label>
        <select class="tk-llm-inference__select" data-testid="provider" $change={:provider_change}>
          <option value="" selected={provider_id(@config) == ""}>None</option>
          {%if @section_by == "modality"}
            {%for m <- Catalog.catalog_modalities(visible_catalog(@providers, @modality))}
              <option disabled>{Catalog.modality_section_title(m)}</option>
              {%for p <- Catalog.providers_by_modality(m, visible_catalog(@providers, @modality))}
                <option value={p.id} selected={provider_id(@config) == p.id}>{p.label}</option>
              {/for}
            {/for}
          {%else}
            <option disabled>── Cloud Providers ──</option>
            {%for p <- Catalog.providers_by_group("cloud", visible_catalog(@providers, @modality))}
              <option value={p.id} selected={provider_id(@config) == p.id}>{p.label}</option>
            {/for}
            <option disabled>── Proxies & Local ──</option>
            {%for p <- Catalog.providers_by_group("proxyLocal", visible_catalog(@providers, @modality))}
              <option value={p.id} selected={provider_id(@config) == p.id}>{p.label}</option>
            {/for}
            <option disabled>── Advanced ──</option>
            {%for p <- Catalog.providers_by_group("advanced", visible_catalog(@providers, @modality))}
              <option value={p.id} selected={provider_id(@config) == p.id}>{p.label}</option>
            {/for}
          {/if}
        </select>
      </div>

      {%if current_provider(@config, @providers)}
        {%if current_provider(@config, @providers).id == "custom"}
          <div class="tk-llm-inference__field">
            <label class="tk-llm-inference__label">API Type</label>
            <select class="tk-llm-inference__select" data-testid="api-type" $change={:api_type_change}>
              <option value="openai" selected={Catalog.effective_api_shape(@config) == "openai"}>
                OpenAI-compatible
              </option>
              <option value="anthropic" selected={Catalog.effective_api_shape(@config) == "anthropic"}>
                Anthropic-compatible
              </option>
            </select>
          </div>
        {/if}

        {%if current_provider(@config, @providers).requires_key}
          <div class="tk-llm-inference__field">
            <label class="tk-llm-inference__label">API Key</label>
            <p class="tk-llm-inference__hint" data-testid="key-hint">{key_hint(current_provider(@config, @providers))}</p>
          </div>
        {/if}

        {%if Catalog.shows_base_url?(current_provider(@config, @providers))}
          <div class="tk-llm-inference__field">
            <label class="tk-llm-inference__label">Base URL</label>
            <input
              type="text"
              class="tk-llm-inference__input"
              data-testid="base-url"
              placeholder={current_provider(@config, @providers).base_url_placeholder}
              value={config_base_url(@config)}
              $change={:base_url_change}
            />
          </div>
        {/if}

        <div class="tk-llm-inference__field">
          <div class="tk-llm-inference__label-row">
            <label class="tk-llm-inference__label">Model</label>
            <button
              type="button"
              class="tk-llm-inference__link"
              data-testid="fetch-models"
              disabled={@loading_models}
              $click={:fetch_models}
            >
              {fetch_models_label(@available_models, @loading_models)}
            </button>
          </div>
          {%if @available_models != []}
            <select class="tk-llm-inference__select" data-testid="model-select" $change={:model_select}>
              <option value="" selected={config_model(@config) == ""}>
                Default ({current_provider(@config, @providers).default_model || "auto"})
              </option>
              {%for m <- @available_models}
                <option value={m} selected={config_model(@config) == m}>{m}</option>
              {/for}
            </select>
            <input
              type="text"
              class="tk-llm-inference__input"
              data-testid="model-text"
              placeholder="Or type a model name manually"
              value={config_model(@config)}
              $change={:model_text_change}
            />
          {%else}
            <input
              type="text"
              class="tk-llm-inference__input"
              data-testid="model-text"
              placeholder={current_provider(@config, @providers).default_model || "model-name"}
              value={config_model(@config)}
              $change={:model_text_change}
            />
          {/if}
          {%if @models_error != ""}
            <p class="tk-llm-inference__hint" data-testid="models-error">{@models_error}</p>
          {/if}
        </div>

        <div class="tk-llm-inference__test-box" data-testid="test-connection">
          <div class="tk-llm-inference__label-row">
            <label class="tk-llm-inference__label">Test Connection</label>
          </div>
          <div class="tk-llm-inference__test-row">
            <input
              type="text"
              class="tk-llm-inference__input"
              data-testid="test-prompt"
              placeholder="Say hello in one sentence"
              value={@test_prompt}
              $change={:test_prompt_change}
            />
            <button
              type="button"
              class="tk-llm-inference__test-button"
              data-testid="test-button"
              disabled={@testing}
              $click={:run_test}
            >
              {%if @testing}
                Sending...
              {%else}
                Test
              {/if}
            </button>
          </div>
          {%if @test_error != ""}
            <div class="tk-llm-inference__error-box" data-testid="test-error">{@test_error}</div>
          {/if}
          {%if @test_reply != ""}
            <div class="tk-llm-inference__response-box" data-testid="test-response">
              <div class="tk-llm-inference__response-label">Response:</div>
              {@test_reply}
            </div>
          {/if}
          <p class="tk-llm-inference__hint">
            Save settings first, then send a test message to verify the provider is reachable.
          </p>
        </div>
      {/if}
    </div>
    """
  end

  def init(props, component, _server) do
    put_state(component,
      config: Map.get(props, :config) || %{},
      providers: Map.get(props, :providers) || [],
      modality: Map.get(props, :modality) || "",
      section_by: Map.get(props, :section_by) || "group",
      transport: Map.get(props, :transport) || "",
      target: Map.get(props, :target) || "parent",
      available_models: [],
      loading_models: false,
      models_error: "",
      test_prompt: "",
      test_reply: "",
      test_error: "",
      testing: false
    )
  end

  # -- client actions --------------------------------------------------------

  # Lit onProviderChange state machine (client-side; catalog is public).
  def action(:provider_change, params, component) do
    value = params.event.value
    provider = Catalog.provider_by_id(value, Catalog.catalog_or_default(component.state.providers))

    config =
      if value == "" do
        %{"providerID" => "", "baseURL" => nil, "apiKey" => nil, "model" => nil, "apiShape" => nil}
      else
        # Re-target env key specs; literal keys survive the switch (Lit parity).
        prev = component.state.config
        key = rebind_key(prev, provider)

        if value == "zai" do
          Map.merge(Catalog.zai_preset(), %{"apiKey" => key, "providerID" => value})
        else
          %{"providerID" => value, "baseURL" => nil, "apiKey" => key, "model" => nil, "apiShape" => nil}
        end
      end

    put_state(component,
      config: config,
      available_models: [],
      models_error: ""
    )
    |> config_change_action()
  end

  def action(:api_type_change, params, component) do
    put_state(component, config: Map.put(component.state.config, "apiShape", params.event.value))
    |> config_change_action()
  end

  def action(:base_url_change, params, component) do
    value = if params.event.value == "", do: nil, else: params.event.value
    put_state(component, config: Map.put(component.state.config, "baseURL", value))
    |> config_change_action()
  end

  def action(:model_select, params, component) do
    value = if params.event.value == "", do: nil, else: params.event.value
    put_state(component, config: Map.put(component.state.config, "model", value))
    |> config_change_action()
  end

  def action(:model_text_change, params, component) do
    value = if params.event.value == "", do: nil, else: params.event.value
    put_state(component, config: Map.put(component.state.config, "model", value))
    |> config_change_action()
  end

  def action(:test_prompt_change, params, component) do
    put_state(component, test_prompt: params.event.value)
  end

  def action(:fetch_models, _params, component) do
    if provider_id(component.state.config) == "" do
      component
    else
      put_state(component, loading_models: true, models_error: "")
      |> put_command(:fetch_models, %{config: component.state.config, transport: component.state.transport})
    end
  end

  def action(:models_loaded, %{models: models}, component) do
    put_state(component, available_models: models, loading_models: false)
  end

  def action(:models_loaded, _params, component) do
    put_state(component, available_models: [], loading_models: false)
  end

  def action(:models_failed, %{error: error}, component) do
    put_state(component, available_models: [], loading_models: false, models_error: error)
  end

  def action(:models_failed, _params, component) do
    put_state(component, loading_models: false, models_error: "Request failed")
  end

  # Lit runTest: one-shot command (§6.9), result actions settle + forward.
  def action(:run_test, _params, component) do
    put_state(component, testing: true, test_error: "", test_reply: "")
    |> put_command(:test_connection, %{
      config: component.state.config,
      prompt: component.state.test_prompt,
      transport: component.state.transport
    })
  end

  def action(:test_ok, %{content: content, model: _model}, component) do
    put_state(component, testing: false, test_reply: content)
    |> put_action(
      name: :test_complete,
      params: %{ok: true, content: content},
      target: component.state.target
    )
  end

  def action(:test_ok, _params, component), do: component

  def action(:test_failed, %{error: error}, component) do
    put_state(component, testing: false, test_error: error)
    |> put_action(
      name: :test_complete,
      params: %{ok: false, error: error},
      target: component.state.target
    )
  end

  def action(:test_failed, _params, component), do: component

  # No-op catch-all (§6.3).
  def action(_name, _params, component), do: component

  defp config_change_action(component) do
    put_action(component,
      name: :config_change,
      params: %{config: component.state.config},
      target: component.state.target
    )
  end

  # Lit key re-targeting: env specs follow the provider, literals survive.
  defp rebind_key(_prev_config, nil), do: nil

  defp rebind_key(prev_config, provider) do
    prev_key = Map.get(prev_config, "apiKey")

    cond do
      is_map(prev_key) and Map.get(prev_key, "literal") != nil ->
        prev_key

      is_map(prev_key) and Map.get(prev_key, "env") != nil and provider.env_var_name != nil ->
        %{"env" => provider.env_var_name}

      is_map(prev_key) and Map.get(prev_key, "env") != nil ->
        nil

      true ->
        nil
    end
  end

  # -- server commands -------------------------------------------------------

  @doc "`:fetch_models` — `GET {base}/models`, key resolved server-side."
  def command(:fetch_models, params, %Hologram.Server{} = server) do
    params = HostConfig.from_params!(params)
    config = Map.get(params, :config) || %{}

    case key_context(config) do
      {:ok, _shape, url, headers} ->
        case transport(params).call(:get, join_base(url, "/models"), headers, nil) do
          {:ok, %{"data" => ids}} when is_list(ids) ->
            put_action(server, :models_loaded, %{models: model_ids(ids)})

          {:ok, _} ->
            put_action(server, :models_loaded, %{models: []})

          {:error, %{status: status}} ->
            put_action(server, :models_failed, %{
              error: "Request failed (#{status}). Is the endpoint reachable and configured?"
            })

          {:error, %{reason: reason}} ->
            put_action(server, :models_failed, %{error: "Request failed — " <> reason})

          {:error, _} ->
            put_action(server, :models_failed, %{error: "Request failed"})
        end

      {:error, message} ->
        put_action(server, :models_failed, %{error: message})
    end
  end

  # `:test_connection` — one provider round trip, content/error only.
  def command(:test_connection, params, %Hologram.Server{} = server) do
    params = HostConfig.from_params!(params)
    config = Map.get(params, :config) || %{}
    prompt = Map.get(params, :prompt)

    prompt = if prompt in [nil, ""], do: "Say hello in one sentence", else: prompt

    case key_context(config) do
      {:ok, shape, url, headers} ->
        model = Catalog.config_model(config) || default_model_of(config)

        cond do
          url == nil ->
            put_action(server, :test_failed, %{error: "No base URL — set one in the advanced section."})

          model in [nil, "", "model-name"] ->
            put_action(server, :test_failed, %{error: "No model — type one or click \"Fetch models\"."})

          true ->
            run_test_call(server, params, shape, url, headers, model, prompt)
        end

      {:error, message} ->
        put_action(server, :test_failed, %{error: message})
    end
  end

  def command(_name, _params, server), do: server

  defp run_test_call(server, params, shape, url, headers, model, prompt) do
    path = if shape == "anthropic", do: "/messages", else: "/chat/completions"

    body = %{
      model: model,
      max_tokens: 256,
      messages: [%{"role" => "user", "content" => prompt}]
    }

    case transport(params).call(:post, join_base(url, path), headers, body) do
      {:ok, resp} when is_map(resp) ->
        content =
          if shape == "anthropic",
            do: Catalog.parse_anthropic_content(resp),
            else: Catalog.parse_openai_content(resp)

        put_action(server, :test_ok, %{content: content, model: Catalog.response_model(resp, model)})

      {:ok, _} ->
        put_action(server, :test_failed, %{error: "Request failed — malformed response."})

      {:error, %{status: status}} ->
        put_action(server, :test_failed, %{error: "Request failed (#{status}). Is the endpoint reachable and configured?"})

      {:error, %{reason: reason}} ->
        put_action(server, :test_failed, %{error: "Request failed — " <> reason})

      {:error, _} ->
        put_action(server, :test_failed, %{error: "Request failed — is the API running and LLM configured?"})
    end
  end

  # Resolve shape/URL/headers (key INCLUDED in headers — server-side only,
  # never logged, never returned) or surface the key error message.
  defp key_context(config) do
    shape = Catalog.effective_api_shape(config)
    base = Catalog.effective_base_url(config)
    provider = Catalog.provider_by_id(Catalog.config_provider_id(config))

    if provider && provider.requires_key do
      case resolve_key(provider) do
        {:ok, key} ->
          headers =
            if shape == "anthropic" do
              [
                {"x-api-key", key},
                {"anthropic-version", "2023-06-01"},
                {"content-type", "application/json"}
              ]
            else
              [{"authorization", "Bearer " <> key}, {"content-type", "application/json"}]
            end

          {:ok, shape, base, headers}

        {:error, message} ->
          {:error, message}
      end
    else
      {:ok, shape, base, [{"content-type", "application/json"}]}
    end
  end

  # Key resolution: HostConfig :llm_providers wins; env specs resolve via
  # System.get_env at call time. Never logs or returns the key.
  defp resolve_key(provider) do
    config = HostConfig.resolve(:llm_providers)

    entry =
      Map.get(config, String.to_atom(provider.id)) ||
        Map.get(config, provider.id)

    spec =
      case entry do
        %{api_key: key} -> key
        %{"api_key" => key} -> key
        _ -> nil
      end

    cond do
      is_binary(spec) and spec != "" ->
        {:ok, spec}

      is_map(spec) and Map.get(spec, :literal) != nil ->
        {:ok, Map.get(spec, :literal)}

      is_map(spec) and Map.get(spec, "literal") != nil ->
        {:ok, Map.get(spec, "literal")}

      is_map(spec) and Map.get(spec, :env) != nil ->
        env_key(spec, :env, provider)

      is_map(spec) and Map.get(spec, "env") != nil ->
        env_key(spec, "env", provider)

      true ->
        key_error(provider)
    end
  rescue
    e in ArgumentError -> {:error, Exception.message(e)}
  end

  defp env_key(spec, key, provider) do
    name = Map.get(spec, key)
    value = System.get_env(name)

    if value in [nil, ""] do
      key_error(provider)
    else
      {:ok, value}
    end
  end

  defp key_error(provider) do
    if provider.env_var_name do
      {:error, "No API key — set it in host config or via #{provider.env_var_name}."}
    else
      {:error, "No API key — add one in the host config."}
    end
  end

  defp default_model_of(config) do
    case Catalog.provider_by_id(Catalog.config_provider_id(config)) do
      nil -> nil
      p -> p.default_model
    end
  end

  # Transport seam (Lit's injectable fetch): a module NAME string whose
  # call/4 mirrors Support.Http outcomes. Empty string → Support.Http.
  defp transport(params) do
    case Map.get(params, :transport) || "" do
      "" -> Http
      name -> String.to_existing_atom(name)
    end
  end

  defp join_base(nil, _path), do: nil
  defp join_base(base, path), do: String.trim_trailing(base, "/") <> path

  defp model_ids(ids) do
    Enum.flat_map(ids, fn m ->
      if is_map(m) and Map.get(m, "id") != nil, do: [Map.get(m, "id")], else: []
    end)
  end

  # -- public template helpers ------------------------------------------------

  @doc "Config `providerID` (empty string when unset)."
  def provider_id(config), do: Catalog.config_provider_id(config)

  @doc "Current provider record or nil (template-facing)."
  def current_provider(config), do: current_provider(config, [])

  def current_provider(config, providers) do
    Catalog.provider_by_id(provider_id(config), Catalog.catalog_or_default(providers))
  end

  @doc """
  The picker's provider list: the host catalog (or the built-in one) after
  the optional modality filter. `""` filters nothing — the historic list.
  """
  def visible_catalog(providers, modality) do
    catalog = Catalog.catalog_or_default(providers)

    if modality == "" or modality == nil do
      catalog
    else
      Catalog.providers_by_modality(modality, catalog)
    end
  end

  @doc "Key field hint: env-var NAME or the custom-endpoint copy — never a value."
  def key_hint(provider) do
    Catalog.env_hint(provider) ||
      if provider.id == "custom" do
        "The key is sent as the endpoint's auth header (Bearer, or x-api-key for Anthropic-shaped endpoints). Keys resolve server-side via host config."
      else
        "Keys resolve server-side via host config or #{provider.env_var_name}."
      end
  end

  @doc "Lit fetch-models label state machine."
  def fetch_models_label(available, loading)
  def fetch_models_label(_available, true), do: "Loading..."
  def fetch_models_label([], false), do: "Fetch models"
  def fetch_models_label(_, false), do: "Refresh models"

  @doc "Config baseURL for the input value (empty string when unset)."
  def config_base_url(config), do: Catalog.config_base_url(config) || ""

  @doc "Config model for input values (empty string when unset)."
  def config_model(config), do: Catalog.config_model(config) || ""
end
