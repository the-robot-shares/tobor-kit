defmodule ToborKit.Hologram.Waitlist.Form do
  @moduledoc """
  Mirror of `<noizu-waitlist>` (contract class B + commands — PORTING.md
  §6.7): manifest-driven signup form for the foryou public API.

  Lit renders the fallback email form until a manifest upgrades the fields;
  the mirror does the same, so the no-fetch path is the Lit no-slug path.
  The manifest GET and the signup POST run server-side via the
  `:waitlist_api` HostConfig scope (or the public `api` attr — the foryou
  API is public and takes no credentials; `credentials: omit` in Lit maps
  to "no token is ever attached").

  **Host requirement (class B): embed with a `cid`.**

  Backend: `:waitlist_api` HostConfig scope (`%{base_url, token?, transport?}`);
  the public `api` attr overrides it when set. Resolved in `command/3` only.
  """

  use Hologram.Component

  alias ToborKit.Hologram.HostConfig
  alias ToborKit.Hologram.Support.Classes
  alias ToborKit.Hologram.Support.Http

  prop :slug, :string, default: ""
  prop :service, :string, default: ""
  prop :list, :string, default: ""
  prop :api, :string, default: ""
  prop :source, :string, default: ""
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  # — copy (Lit model.ts COPY) —

  def copy(:required), do: "This field is required."
  def copy(:email), do: "Enter a valid email address."
  def copy(:select), do: "Choose one of the options."
  def copy(:multi), do: "Invalid selection."
  def copy(:rate_limit), do: "Too many attempts — please wait a moment and try again."
  def copy(:generic), do: "Something went wrong — please try again."
  def copy(:unavailable), do: "We couldn't load this form. Please try again later."
  def copy(:not_found), do: "This sign-up form isn't available right now."
  def copy(:success_single), do: "You're on the list!"
  def copy(:success_double), do: "Check your inbox to confirm your spot."
  def copy(:joining), do: "Joining…"
  def copy(:join), do: "Join"

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-waitlist", @class)}>
      {%if @ui == "loading"}
        <div aria-busy="true">
          <div class={@status_kind} role="status" aria-live="polite" data-cy="waitlist.status">{@status_text}</div>
        </div>
      {/if}
      {%if @ui == "success" or @ui == "unavailable"}
        <div class={@status_kind} role="status" aria-live="polite" data-cy="waitlist.status">{@status_text}</div>
      {/if}
      {%if @ui == "form"}
        {%if @list_name != ""}
          <h2>{@list_name}</h2>
        {/if}
        {%if @list_description != ""}
          <p>{@list_description}</p>
        {/if}
        <form class="tk-waitlist__form" data-cy="waitlist.form" novalidate $submit={:submit}>
          {%for attr <- fields(@list_attrs)}
            {%if attr.type == "multiselect"}
              <div class="field-group">
                <span class="field-label">{field_label(attr)}</span>
                {%for option <- attr.options}
                  <label>
                    <input
                      type="checkbox"
                      checked={in_list?(Map.get(@values, attr.slug, []), option.value)}
                      $change={action: :field_toggle, params: %{slug: attr.slug, option: option.value}}
                    />
                    {option.label}
                  </label>
                {/for}
                {%if Map.get(@field_errors, attr.slug, "") != ""}
                  <div>{Map.get(@field_errors, attr.slug, "")}</div>
                {/if}
              </div>
            {/if}
            {%if attr.type == "select"}
              <div class="field-group">
                <label class="field-label">{field_label(attr)}</label>
                <select
                  class="field-select"
                  required={attr.required}
                  aria-required={attr.required}
                  aria-invalid={error_flag(@field_errors, attr.slug)}
                  data-cy={email_cy(attr)}
                  $change={action: :field_set, params: %{slug: attr.slug}}
                >
                  <option value="">{if(attr.required, do: "Select…", else: "—")}</option>
                  {%for option <- attr.options}
                    <option value={option.value} selected={option.value == Map.get(@values, attr.slug, "")}>{option.label}</option>
                  {/for}
                </select>
                {%if Map.get(@field_errors, attr.slug, "") != ""}
                  <div>{Map.get(@field_errors, attr.slug, "")}</div>
                {/if}
              </div>
            {/if}
            {%if attr.type == "text"}
              <div class="field-group">
                <label class="field-label">{field_label(attr)}</label>
                <textarea
                  class="field-textarea"
                  required={attr.required}
                  aria-required={attr.required}
                  aria-invalid={error_flag(@field_errors, attr.slug)}
                  maxlength={maxlength(attr)}
                  data-cy={email_cy(attr)}
                  value={Map.get(@values, attr.slug, "")}
                  $input={action: :field_set, params: %{slug: attr.slug}}
                ></textarea>
                {%if Map.get(@field_errors, attr.slug, "") != ""}
                  <div>{Map.get(@field_errors, attr.slug, "")}</div>
                {/if}
              </div>
            {/if}
            {%if attr.type != "multiselect" and attr.type != "select" and attr.type != "text"}
              <div class="field-group">
                <label class="field-label">{field_label(attr)}</label>
                <input
                  class="field-input"
                  type={input_type(attr)}
                  required={attr.required}
                  aria-required={attr.required}
                  aria-invalid={error_flag(@field_errors, attr.slug)}
                  autocomplete={autocomplete(attr)}
                  inputmode={inputmode(attr)}
                  step={step(attr)}
                  min={min_bound(attr)}
                  max={max_bound(attr)}
                  maxlength={maxlength(attr)}
                  spellcheck={guid?(attr)}
                  data-cy={email_cy(attr)}
                  value={Map.get(@values, attr.slug, "")}
                  $input={action: :field_set, params: %{slug: attr.slug}}
                />
                {%if Map.get(@field_errors, attr.slug, "") != ""}
                  <div>{Map.get(@field_errors, attr.slug, "")}</div>
                {/if}
              </div>
            {/if}
          {/for}
          <input
            type="text"
            name="company_website"
            class="tk-waitlist__honeypot"
            hidden
            tabindex="-1"
            autocomplete="off"
            aria-hidden="true"
          />
          <button type="submit" class="btn" data-cy="waitlist.submit" disabled={@busy}>
            {if(@busy, do: copy(:joining), else: copy(:join))}
          </button>
        </form>
        <div class={@status_kind} role="status" aria-live="polite" data-cy="waitlist.status">{@status_text}</div>
      {/if}
    </div>
    """
  end

  def init(props, component, _server) do
    put_state(component,
      ui: "form",
      busy: false,
      submitted: false,
      status_text: "",
      status_kind: "",
      field_errors: %{},
      list_attrs: [fallback_email()],
      list_name: "",
      list_description: "",
      success_message: "",
      opt_in_mode: "single",
      values: %{},
      slug: Map.get(props, :slug) || "",
      service: Map.get(props, :service) || "",
      list: Map.get(props, :list) || "",
      api: Map.get(props, :api) || "",
      source: Map.get(props, :source) || "",
      target: Map.get(props, :target) || "parent"
    )
  end

  # — client actions —

  def action(:field_set, params, component) do
    values = Map.put(component.state.values, params.slug, params.event.value)
    component = put_state(component, values: values)

    clear_error_if_submitted(component, params.slug)
  end

  def action(:field_toggle, params, component) do
    current = Map.get(component.state.values, params.slug, [])

    current =
      if is_list(current) do
        current
      else
        []
      end

    next =
      if params.event.value == true do
        if in_options?(current, params.option), do: current, else: current ++ [params.option]
      else
        Enum.filter(current, fn item -> item != params.option end)
      end

    component = put_state(component, values: Map.put(component.state.values, params.slug, next))

    clear_error_if_submitted(component, params.slug)
  end

  # Explicit load trigger (see README delta — no mount-time fetch).
  def action(:load, _params, component) do
    if component.state.ui == "form" and component.state.list_attrs == [fallback_email()] do
      component
      |> put_state(ui: "loading", status_text: "Loading…")
      |> put_command(:load_manifest, %{
        base: component.state.api,
        slug: component.state.slug,
        service: component.state.service,
        list: component.state.list
      })
    else
      component
    end
  end

  def action(:manifest_loaded, params, component) do
    put_state(component,
      ui: "form",
      busy: false,
      submitted: false,
      status_text: "",
      status_kind: "",
      field_errors: %{},
      values: %{},
      list_attrs: Map.get(params, :attributes, [fallback_email()]),
      list_name: Map.get(params, :list_name, ""),
      list_description: Map.get(params, :list_description, ""),
      opt_in_mode: Map.get(params, :opt_in_mode, "single"),
      success_message: Map.get(params, :success_message, "")
    )
  end

  def action(:manifest_error, params, component) do
    component
    |> put_state(
      ui: "unavailable",
      busy: false,
      status_kind: "danger",
      status_text: params.message
    )
    |> put_action(
      name: :waitlist_error,
      params: %{error: params.message, status: Map.get(params, :status)},
      target: component.state.target
    )
  end

  # Lit `onSubmit`: validate, focus-first-bad (N/A — no DOM access), then POST.
  def action(:submit, _params, component) do
    if component.state.busy or component.state.ui != "form" do
      component
    else
      attrs = fields(component.state.list_attrs)
      errors = validate_all(attrs, component.state.values)

      if errors == %{} do
        component
        |> put_state(busy: true, submitted: true, status_text: "", status_kind: "")
        |> put_command(:signup, %{
          base: component.state.api,
          slug: component.state.slug,
          service: component.state.service,
          list: component.state.list,
          source: if(component.state.source != "", do: component.state.source, else: "widget"),
          values: collect_values(attrs, component.state.values),
          company_website: ""
        })
      else
        put_state(component, field_errors: errors, submitted: true)
      end
    end
  end

  def action(:signup_success, params, component) do
    message = success_copy(component.state.success_message, component.state.opt_in_mode)

    component
    |> put_state(ui: "success", busy: false, status_kind: "success", status_text: message)
    |> put_action(
      name: :waitlist_success,
      params: %{values: Map.get(params, :values, %{}), source: Map.get(params, :source, "")},
      target: component.state.target
    )
  end

  def action(:signup_error, params, component) do
    component
    |> put_state(busy: false, status_kind: "danger", status_text: params.message)
    |> put_action(
      name: :waitlist_error,
      params: %{error: params.message, status: Map.get(params, :status)},
      target: component.state.target
    )
  end

  def action(_, _params, component), do: component

  # — server commands (one request each, §6.9) —

  def command(:load_manifest, params, server) do
    params = HostConfig.from_params!(params)

    case manifest_url(params) do
      "" ->
        put_action(server, :manifest_error, %{message: copy(:unavailable)})

      url ->
        case transport(params).get(url) do
          {:ok, body} ->
            loaded = normalize_list(body)

            put_action(server, :manifest_loaded, %{
              attributes: loaded.attributes,
              list_name: loaded.list_name,
              list_description: loaded.list_description,
              opt_in_mode: loaded.opt_in_mode,
              success_message: loaded.success_message
            })

          {:error, %{status: 404}} ->
            put_action(server, :manifest_error, %{message: copy(:not_found), status: 404})

          {:error, %{status: status}} ->
            put_action(server, :manifest_error, %{message: copy(:unavailable), status: status})

          {:error, _reason} ->
            put_action(server, :manifest_error, %{message: copy(:unavailable)})
        end
    end
  end

  def command(:signup, params, server) do
    params = HostConfig.from_params!(params)

    url = manifest_url(params)

    payload = %{
      values: Map.get(params, :values, %{}),
      source: Map.get(params, :source, "widget"),
      company_website: Map.get(params, :company_website, "")
    }

    case transport(params).post(url <> "/signups", payload) do
      {:ok, _body} ->
        put_action(server, :signup_success, %{
          values: payload.values,
          source: payload.source
        })

      {:error, %{status: 429}} ->
        put_action(server, :signup_error, %{message: copy(:rate_limit), status: 429})

      {:error, %{status: status}} ->
        put_action(server, :signup_error, %{message: copy(:generic), status: status})

      {:error, _reason} ->
        put_action(server, :signup_error, %{message: copy(:generic)})
    end
  end

  # — public: field model (client-safe; Lit model.ts parity) —

  @doc "Manifest-less fallback: a required email field (Lit FALLBACK_EMAIL)."
  def fallback_email do
    %{
      slug: "email",
      name: "Email",
      type: "email",
      required: true,
      is_identity: true,
      options: [],
      validation: %{},
      sort_order: 0
    }
  end

  @doc "Manifest fields or the fallback email (Lit `fields()`)."
  def fields(list_attrs) do
    if list_attrs == [], do: [fallback_email()], else: list_attrs
  end

  @doc "Input type per attribute type (Lit `inputExtras`)."
  def input_type(%{type: "email"}), do: "email"
  def input_type(%{type: "int"}), do: "number"
  def input_type(%{type: "float"}), do: "number"
  def input_type(%{type: "date"}), do: "date"
  def input_type(_), do: "text"

  @doc "Step attribute: 1 for ints, any for floats."
  def step(%{type: "int"}), do: "1"
  def step(%{type: "float"}), do: "any"
  def step(_), do: nil

  @doc "Inputmode hint per type."
  def inputmode(%{type: "email"}), do: "email"
  def inputmode(%{type: "int"}), do: "numeric"
  def inputmode(%{type: "float"}), do: "decimal"
  def inputmode(_), do: nil

  @doc "Autocomplete hint."
  def autocomplete(%{type: "email"}), do: "email"
  def autocomplete(%{type: "guid"}), do: "off"
  def autocomplete(_), do: nil

  @doc "Numeric bounds from the validation map."
  def min_bound(attr), do: Map.get(Map.get(attr, :validation) || %{}, :min)
  def max_bound(attr), do: Map.get(Map.get(attr, :validation) || %{}, :max)

  @doc "Max length from the validation map."
  def maxlength(attr), do: Map.get(Map.get(attr, :validation) || %{}, :length)

  @doc "Label text with the required star (Lit `attr.name` + `? *`)."
  def field_label(attr) do
    if attr.required, do: attr.name <> " *", else: attr.name
  end

  @doc "Registry data-cy for the email control; other fields get none."
  def email_cy(attr) do
    if attr.type == "email" or attr.slug == "email", do: "waitlist.email"
  end

  @doc "aria-invalid flag string (\"\" renders no attribute)."
  def error_flag(field_errors, slug) do
    if Map.get(field_errors, slug, "") != "", do: "true"
  end

  @doc "guid inputs get spellcheck=false (Lit inputExtras)."
  def guid?(%{type: "guid"}), do: "false"
  def guid?(_), do: nil

  @doc "List membership (public: template-called for multiselect checked state)."
  def in_list?(list, item) do
    Enum.filter(list, fn entry -> entry == item end) != []
  end

  @doc "Email shape check without regex: exactly one @, nonempty halves, dotted domain (verified ops only)."
  def email_valid?(value) do
    parts = String.split(value, "@")

    if Enum.count(parts) == 2 do
      [local, domain] = parts

      if local != "" and domain != "" do
        Enum.count(String.split(domain, ".")) >= 2
      else
        false
      end
    else
      false
    end
  end

  @doc "Client-side validation (required + membership + email shape; regex formats are server-owned). Returns slug → message."
  def validate_all(attrs, values) do
    Enum.filter(attrs, fn attr -> error_for(attr, values) != nil end)
    |> Map.new(fn attr -> {attr.slug, error_for(attr, values)} end)
  end

  def error_for(attr, values) do
    raw = Map.get(values, attr.slug, "")

    if attr.type == "multiselect" do
      list = if is_list(raw), do: raw, else: []

      cond_empty =
        if list == [] and attr.required, do: copy(:required), else: nil

      cond_empty ||
        if list != [] and not options_allow?(attr, list), do: copy(:multi), else: nil
    else
      if raw == "" do
        if attr.required, do: copy(:required), else: nil
      else
        if attr.type == "select" do
          if in_options?(Enum.map(attr_options(attr), & &1.value), raw), do: nil, else: copy(:select)
        else
          if attr.type == "email" and not email_valid?(raw), do: copy(:email), else: nil
        end
      end
    end
  end

  # — server-side normalization (public for tests) —

  @doc "Normalizes a manifest body ({list: {name, description, opt_in_mode, settings, attributes}})."
  def normalize_list(body) when is_map(body) do
    list = Map.get(body, "list") || %{}
    settings = Map.get(list, "settings") || %{}

    %{
      list_name: str(Map.get(list, "name")),
      list_description: str(Map.get(list, "description")),
      opt_in_mode: if(Map.get(list, "opt_in_mode") == "double", do: "double", else: "single"),
      success_message: str(Map.get(settings, "success_message")),
      attributes:
        (Map.get(list, "attributes") || [])
        |> Enum.filter(&is_map/1)
        |> Enum.map(&normalize_attr/1)
        |> Enum.sort_by(& &1.sort_order)
    }
  end

  def normalize_list(_),
    do: %{list_name: "", list_description: "", opt_in_mode: "single",
          success_message: "", attributes: []}

  def normalize_attr(item) do
    validation = Map.get(item, "validation") || %{}

    %{
      slug: str(Map.get(item, "slug")),
      name: str(Map.get(item, "name")) |> then(fn n -> if n == "", do: str(Map.get(item, "slug")), else: n end),
      type: known_type(Map.get(item, "type")),
      required: Map.get(item, "required") == true,
      is_identity: Map.get(item, "is_identity") == true or Map.get(item, "isIdentity") == true,
      options: normalize_options(Map.get(item, "options")),
      validation: %{
        min: Map.get(validation, "min"),
        max: Map.get(validation, "max"),
        length: Map.get(validation, "length")
      },
      sort_order: Map.get(item, "sort_order") || 0
    }
  end

  def normalize_options(options) when is_list(options) do
    options
    |> Enum.take(200)
    |> Enum.map(fn option ->
      case option do
        %{} = map when is_map(map) ->
          value = Map.get(map, "value")
          label = Map.get(map, "label")

          value =
            if value == nil, do: to_str(label), else: to_str(value)

          label = if label == nil, do: value, else: to_str(label)
          %{label: label, value: value}

        other ->
          %{label: to_str(other), value: to_str(other)}
      end
    end)
  end

  def normalize_options(_), do: []

  # — internals —

  # base precedence: public `api` attr (params.base) wins; otherwise the
  # :waitlist_api HostConfig scope supplies the endpoint. The foryou API is
  # public — no credentials ride either path (Lit `credentials: omit`).
  defp manifest_url(params) do
    base =
      if nonempty?(Map.get(params, :base)) do
        strip_slash(Map.get(params, :base))
      else
        strip_slash(Map.get(HostConfig.resolve(:waitlist_api), :base_url) || "")
      end

    public_list_url(base, Map.get(params, :slug), Map.get(params, :service), Map.get(params, :list))
  end

  defp transport(params) do
    if nonempty?(Map.get(params, :base)) do
      Http
    else
      Map.get(HostConfig.resolve(:waitlist_api), :transport, Http)
    end
  end

  defp public_list_url(base, slug, service, list) do
    slug = slug || ""
    service = service || ""
    list = list || ""

    cond do
      nonempty?(slug) ->
        base <> "/api/v1/public/lists/" <> URI.encode(slug)

      nonempty?(service) and nonempty?(list) ->
        base <> "/api/v1/public/services/" <> URI.encode(service) <> "/lists/" <> URI.encode(list)

      true ->
        ""
    end
  end

  defp strip_slash(url) do
    if String.ends_with?(url, "/"), do: String.slice(url, 0, String.length(url) - 1), else: url
  end

  defp clear_error_if_submitted(component, slug) do
    if component.state.submitted do
      put_state(component,
        field_errors: Map.delete(component.state.field_errors, slug)
      )
    else
      component
    end
  end

  defp collect_values(attrs, values) do
    attrs
    |> Enum.map(fn attr -> {attr.slug, Map.get(values, attr.slug, "")} end)
    |> Enum.filter(fn {_slug, raw} ->
      if is_list(raw), do: raw != [], else: raw != ""
    end)
    |> Map.new()
  end

  defp success_copy(message, opt_in_mode) do
    if message != "" do
      message
    else
      if opt_in_mode == "double", do: copy(:success_double), else: copy(:success_single)
    end
  end

  defp options_allow?(attr, list) do
    allowed = Enum.map(attr_options(attr), & &1.value)

    Enum.filter(list, fn item -> not in_options?(allowed, item) end) == []
  end

  defp attr_options(attr), do: Map.get(attr, :options) || []

  defp in_options?(list, item) do
    Enum.filter(list, fn entry -> entry == item end) != []
  end

  defp known_type(type) when is_binary(type) do
    if type in ["email", "string", "text", "int", "float", "date", "guid", "select", "multiselect"] do
      type
    else
      "string"
    end
  end

  defp known_type(_), do: "string"

  defp nonempty?(value) when is_binary(value), do: value != ""
  defp nonempty?(_), do: false

  defp str(value) when is_binary(value), do: value
  defp str(_), do: ""

  defp to_str(value) when is_binary(value), do: value
  defp to_str(value), do: String.Chars.to_string(value)
end
