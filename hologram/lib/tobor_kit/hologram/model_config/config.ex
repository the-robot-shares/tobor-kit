defmodule ToborKit.Hologram.ModelConfig.Config do
  @moduledoc """
  Mirror of `<noizu-model-config>` (contract class B + commands — PORTING.md §6.7).

  Model picker island: catalog select (Inherit / entries / Custom), custom
  endpoint fieldset (base URL + model + key), optional budget input.
  Properties down, actions up — the host persists; the mirror never stores
  secrets and never logs keys: the API-key draft lives in transient client
  state and `custom-endpoint-save` carries `""` when the typed value is
  empty or a masked echo (`••••1234`), meaning "keep the stored key".

  Catalog sources: `catalog` prop (host-fetched), or the `:load_catalog`
  command which GETs the `catalog-url` (public data) — or the `:catalog`
  HostConfig scope base URL when no URL is given. HostConfig is resolved
  inside `command/3` only.

  **Host requirement (class B): embed with a `cid`.**

  Backend: none required (public catalog URL); `:catalog` HostConfig scope
  (`%{base_url}`, optional `transport` injection key) is used by
  `:load_catalog` when the command is invoked without a URL.
  """

  use Hologram.Component

  alias ToborKit.Hologram.HostConfig
  alias ToborKit.Hologram.Support.Classes
  alias ToborKit.Hologram.Support.Http

  prop :catalog, :list, default: []
  prop :catalog_url, :string, default: ""
  prop :value, :string, default: ""
  prop :inherit, :boolean, default: false
  prop :allow_custom, :boolean, default: false
  prop :allow_budget, :boolean, default: false
  prop :budget, :float, default: nil
  prop :custom_endpoint, :map, default: nil
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  @inherit_option "__inherit__"
  @custom_option "__custom__"

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-model-config", @class)}>
      <div class="tk-model-config__stack">
        <label class="tk-model-config__field">
          <span>Model</span>
          <select
            class="tk-model-config__select"
            data-cy="model.picker"
            aria-label="Model"
            $change={:pick}
          >
            {%if @inherit}
              <option value="__inherit__" selected={select_value(@value, @inherit, @allow_custom, entries(@catalog, @loaded)) == "__inherit__"}>Inherit</option>
            {/if}
            {%if !@inherit and @value == ""}
              <option value="" disabled>Select a model…</option>
            {/if}
            {%for entry <- entries(@catalog, @loaded)}
              <option value={spec_of(entry)} selected={spec_of(entry) == select_value(@value, @inherit, @allow_custom, entries(@catalog, @loaded))}>{entry_label(entry)}</option>
            {/for}
            {%if @allow_custom}
              <option value="__custom__" selected={select_value(@value, @inherit, @allow_custom, entries(@catalog, @loaded)) == "__custom__"}>Custom…</option>
            {/if}
            {%if orphan_option?(@value, @inherit, entries(@catalog, @loaded))}
              <option value={@value} selected={true}>{@value}</option>
            {/if}
          </select>
        </label>
        {%if @catalog_error != ""}
          <div class="notice notice--error" role="status">{@catalog_error}</div>
        {/if}
        {%if show_custom?(@value, @inherit, @allow_custom, entries(@catalog, @loaded))}
          <fieldset class="tk-model-config__custom" data-cy="model.custom">
            <legend>Custom endpoint</legend>
            <label class="tk-model-config__field">
              <span>Base URL</span>
              <input
                class="tk-model-config__input"
                name="baseUrl"
                type="url"
                autocomplete="off"
                placeholder="https://api.openai.com/v1"
                value={@draft_base_url}
                $input={:set_base_url}
              />
            </label>
            <label class="tk-model-config__field">
              <span>Model</span>
              <input
                class="tk-model-config__input"
                name="model"
                type="text"
                autocomplete="off"
                value={@draft_model}
                $input={:set_custom_model}
              />
            </label>
            <label class="tk-model-config__field">
              <span>API key</span>
              <input
                class="tk-model-config__input"
                name="apiKey"
                type={if(masked_key?(@draft_api_key), do: "text", else: "password")}
                autocomplete="off"
                spellcheck="false"
                value={@draft_api_key}
                $input={:set_api_key}
              />
            </label>
            <button type="button" class="tk-model-config__save" data-cy="model.save" $click={:save_endpoint}>
              Save endpoint
            </button>
          </fieldset>
        {/if}
        {%if @allow_budget}
          <label class="tk-model-config__field">
            <span>Budget</span>
            <input
              class="tk-model-config__input"
              data-cy="model.budget"
              type="number"
              min="0"
              step="any"
              inputmode="decimal"
              aria-label="Budget"
              value={@budget_text}
              $change={:budget_changed}
            />
          </label>
        {/if}
      </div>
    </div>
    """
  end

  def init(props, component, _server) do
    custom = Map.get(props, :custom_endpoint)

    put_state(component,
      catalog: Map.get(props, :catalog) || [],
      loaded: [],
      catalog_error: "",
      value: Map.get(props, :value) || "",
      inherit: Map.get(props, :inherit) == true,
      allow_custom: Map.get(props, :allow_custom) == true,
      allow_budget: Map.get(props, :allow_budget) == true,
      budget_text: budget_text(Map.get(props, :budget)),
      draft_base_url: endpoint_field(custom, "base_url", "baseUrl"),
      draft_model: endpoint_field(custom, "model", "model"),
      draft_api_key: endpoint_field(custom, "api_key", "apiKey"),
      target: Map.get(props, :target) || "parent"
    )
  end

  # — client actions —

  # Lit `onPick`: Inherit clears the value, Custom re-derives from the
  # draft model, anything else is the picked spec verbatim.
  def action(:pick, params, component) do
    picked = params.event.value

    value =
      if picked == @inherit_option do
        ""
      else
        if picked == @custom_option do
          custom_spec(component.state.draft_model)
        else
          picked
        end
      end

    component
    |> put_state(value: value)
    |> forward_model_change(value)
  end

  def action(:set_base_url, params, component) do
    put_state(component, draft_base_url: params.event.value)
  end

  def action(:set_custom_model, params, component) do
    put_state(component, draft_model: params.event.value)
  end

  def action(:set_api_key, params, component) do
    put_state(component, draft_api_key: params.event.value)
  end

  # Lit `onSave`: masked/empty key → "" ("keep stored"). Lit emits BOTH
  # custom-endpoint-save and model-change; §6.9 allows one action per
  # dispatch, so the derived spec rides along as `value` on the save action.
  def action(:save_endpoint, _params, component) do
    api_key = api_key_for_save(component.state.draft_api_key)
    model = component.state.draft_model
    spec = custom_spec(model)

    component
    |> put_state(value: spec)
    |> put_action(
      name: :custom_endpoint_save,
      params: %{
        base_url: component.state.draft_base_url,
        model: model,
        api_key: api_key,
        value: spec
      },
      target: component.state.target
    )
    |> then(fn component ->
      if api_key == "" do
        component
      else
        put_state(component, draft_api_key: "")
      end
    end)
  end

  def action(:budget_changed, params, component) do
    text = params.event.value
    amount = if text == "", do: 0, else: text

    component
    |> put_state(budget_text: text)
    |> put_action(
      name: :budget_change,
      params: %{amount: amount},
      target: component.state.target
    )
  end

  def action(:catalog_loaded, params, component) do
    component = put_state(component, loaded: params.entries, catalog_error: "")

    seed_custom(component, Map.get(params, :custom))
  end

  def action(:catalog_error, params, component) do
    put_state(component, loaded: [], catalog_error: params.message)
  end

  def action(_, _params, component), do: component

  # — server commands (one request each, §6.9) —

  # Params may carry the public catalog URL (Lit `catalog-url` attr data);
  # without one, the `:catalog` HostConfig scope supplies the base URL.
  def command(:load_catalog, params, server) do
    params = HostConfig.from_params!(params)

    url =
      if nonempty?(Map.get(params, :url)) do
        Map.get(params, :url)
      else
        # Raises when the host never wired :catalog — a command asking for
        # config the host never provided is a bug, not an empty-URL case.
        HostConfig.resolve(:catalog) |> Map.get(:base_url)
      end

    fetch_catalog(url, catalog_transport(), server)
  end

  # Transport injection seam: the `:catalog` scope map may carry a
  # `transport` module (Support.Http outcome shape) for tests/gallery.
  # Tolerates an unwired :catalog scope — the public-URL path needs no
  # host config, and production falls through to Support.Http.
  defp catalog_transport do
    Map.get(HostConfig.resolve(:catalog), :transport, Http)
  rescue
    ArgumentError -> Http
  end

  defp fetch_catalog(url, http, server) do
    case http.get(url) do
      {:ok, body} ->
        payload = normalize_catalog_payload(body)

        put_action(server, :catalog_loaded, %{
          entries: payload.entries,
          custom: payload.custom
        })

      {:error, _err} ->
        put_action(server, :catalog_error, %{message: "Could not load the model catalog."})
    end
  end

  # — public: template-called helpers transpile client-side —

  @doc "Display entries: the `catalog` prop wins over command-loaded entries (Lit `entries()`)."
  def entries(catalog, loaded) do
    if catalog != [], do: catalog, else: loaded
  end

  @doc "Exact spec to store; defaults to `provider:model` (Lit `specOf`). Atom/string tolerant."
  def spec_of(entry) do
    spec = Map.get(entry, "spec") || Map.get(entry, :spec)
    provider = Map.get(entry, "provider") || Map.get(entry, :provider)
    model = Map.get(entry, "model") || Map.get(entry, :model)

    if nonempty?(spec) do
      spec
    else
      provider <> ":" <> model
    end
  end

  @doc "Option label: trimmed label or the spec (Lit `entry.label?.trim() || spec`)."
  def entry_label(entry) do
    label = Map.get(entry, "label") || Map.get(entry, :label)

    if nonempty?(label) do
      label
    else
      spec_of(entry)
    end
  end

  @doc "Empty or `inherit` means inherit (Lit `isInheritValue`)."
  def inherit_value?(value), do: value == "" or value == "inherit"

  @doc "`custom` or `custom:<model>` (Lit `isCustomValue`)."
  def custom_value?(value) do
    value == "custom" or String.starts_with?(value, "custom:")
  end

  @doc "Spec for a custom endpoint model (Lit `customSpec`)."
  def custom_spec(model) do
    trimmed = String.replace(model, " ", "")

    if trimmed == "" do
      "custom"
    else
      "custom:" <> trimmed
    end
  end

  @doc "True when the field looks like a host echo (`••••1234`, `***…`, `xxxx…`), not a new secret. Regex-free client-side shape of Lit `isMaskedSecret`."
  def masked_key?(value) do
    String.starts_with?(value, "•") or
      String.starts_with?(value, "***") or
      String.starts_with?(value, "xxxx") or
      String.starts_with?(value, "XXXX")
  end

  @doc "Empty or masked input means keep the stored key — emit \"\" (Lit `apiKeyForSave`)."
  def api_key_for_save(typed) do
    if masked_key?(typed), do: "", else: typed
  end

  @doc "Current select value: Inherit option, Custom option, or the raw value (Lit `selectValue`)."
  def select_value(value, inherit, allow_custom, entries_list) do
    if inherit and inherit_value?(value) do
      "__inherit__"
    else
      if allow_custom and custom_selection?(value, entries_list) do
        "__custom__"
      else
        value
      end
    end
  end

  @doc "True when the current value is not a catalog entry and not inherit — Lit shows it as a selected orphan option."
  def orphan_option?(value, _inherit, entries_list) do
    if value == "" or inherit_value?(value) or custom_value?(value) do
      false
    else
      not in_entries?(value, entries_list)
    end
  end

  @doc "Custom fieldset visibility: allow_custom and the picker currently shows Custom (Lit `showCustom`)."
  def show_custom?(value, inherit, allow_custom, entries_list) do
    allow_custom and select_value(value, inherit, allow_custom, entries_list) == @custom_option
  end

  # — server-side normalization (public for tests) —

  @doc "Normalizes a catalog GET body (array, `{catalog}`, `{models}`, or `{entries}` + optional custom endpoint) into atom-keyed shapes."
  def normalize_catalog_payload(body) when is_map(body) do
    raw =
      first_list(body, "catalog") || first_list(body, "models") || first_list(body, "entries") || []

    %{
      entries: Enum.map(raw, &normalize_entry/1),
      custom: normalize_custom(body)
    }
  end

  def normalize_catalog_payload(body) when is_list(body) do
    %{entries: Enum.map(body, &normalize_entry/1), custom: nil}
  end

  def normalize_catalog_payload(_), do: %{entries: [], custom: nil}

  def normalize_entry(item) when is_map(item) do
    provider = str(Map.get(item, "provider"))
    model = str(Map.get(item, "model"))
    label = str(Map.get(item, "label"))
    spec = str(Map.get(item, "spec"))

    %{provider: provider, model: model, label: label, spec: spec}
  end

  def normalize_entry(_), do: %{provider: "", model: "", label: "", spec: ""}

  def normalize_custom(body) do
    raw = Map.get(body, "custom") || Map.get(body, "customEndpoint") || Map.get(body, "custom_endpoint")

    case raw do
      %{} = custom when not is_struct(custom) ->
        base_url = str(Map.get(custom, "base_url") || Map.get(custom, "baseUrl"))
        model = str(Map.get(custom, "model"))
        api_key = str(Map.get(custom, "api_key") || Map.get(custom, "apiKey"))

        if base_url == "" and model == "" and api_key == "" do
          nil
        else
          %{base_url: base_url, model: model, api_key: api_key}
        end

      _ ->
        nil
    end
  end

  # — internals (verified op set for client-reachable code) —

  defp forward_model_change(component, value) do
    put_action(
      component,
      name: :model_change,
      params: %{value: value},
      target: component.state.target
    )
  end

  defp seed_custom(component, custom) do
    if is_map(custom) and component.state.draft_base_url == "" and component.state.draft_api_key == "" do
      put_state(component,
        draft_base_url: Map.get(custom, :base_url) || component.state.draft_base_url,
        draft_model: Map.get(custom, :model) || component.state.draft_model,
        draft_api_key: Map.get(custom, :api_key) || component.state.draft_api_key
      )
    else
      component
    end
  end

  defp custom_selection?(value, entries_list) do
    if custom_value?(value) or value == "" or inherit_value?(value) do
      custom_value?(value)
    else
      not in_entries?(value, entries_list)
    end
  end

  defp in_entries?(spec, entries_list) do
    Enum.filter(entries_list, fn entry -> spec_of(entry) == spec end) != []
  end

  defp nonempty?(value) when is_binary(value), do: value != ""
  defp nonempty?(_), do: false

  defp budget_text(nil), do: ""
  defp budget_text(value), do: String.Chars.to_string(value)

  defp endpoint_field(nil, _snake, _camel), do: ""

  defp endpoint_field(custom, snake, camel) do
    Map.get(custom, snake) || Map.get(custom, camel) || ""
  end

  defp first_list(body, key) do
    case Map.get(body, key) do
      value when is_list(value) -> value
      _ -> nil
    end
  end

  defp str(value) when is_binary(value), do: String.replace(value, " ", "")
  defp str(_), do: ""
end
