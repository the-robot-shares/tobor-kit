defmodule ToborKit.Hologram.Configurator.Playground do
  @moduledoc """
  Mirror of `<tobor-configurator>` (contract class B + commands — PORTING.md
  §6.7): schema-driven playground form with a live preview frame and a
  copyable HTML snippet.

  Schema resolution order (Lit): `schema` property → child
  `script[type=application/json]` → `schema-src` URL. The mirror supports
  the `schema` prop (string-keyed map, §6.2) and the `schema-src` URL via
  the `:load_schema` command (public data, GET). The child-script path is
  N/A in Hologram — there is no slotted-DOM text to read (documented).

  **Host requirement (class B): embed with a `cid`.**

  Backend: none required (public schema URL); a `transport` key on the
  `:catalog` HostConfig scope map (optional) injects a test/gallery
  transport. HostConfig is consulted inside `command/3` only, and
  tolerantly — the public-URL path needs no host wiring.
  """

  use Hologram.Component

  alias ToborKit.Hologram.HostConfig
  alias ToborKit.Hologram.Support.Classes
  alias ToborKit.Hologram.Support.Http

  prop :schema, :map, default: nil
  prop :schema_src, :string, default: ""
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-configurator", @class)}>
      {%if @error != ""}
        <div class="notice notice--error" role="alert">{@error}</div>
      {/if}
      {%if @loading}
        <p class="muted" aria-busy="true">Loading schema</p>
      {/if}
      {%if @schema == nil and @error == "" and not @loading}
        <p class="muted">
          Provide a schema map, or a schema-src URL{%if @schema_src != ""} — fetch it:{/if}
        </p>
        {%if @schema_src != ""}
          <button type="button" class="tk-configurator__load" $click={command: :load_schema, params: %{src: @schema_src}}>
            Load schema
          </button>
        {/if}
      {/if}
      {%if @schema != nil}
        <div class="tk-configurator__layout">
          <form class="tk-configurator__form" data-cy="configurator.form" novalidate $submit={:apply}>
            {%for field <- @schema.fields}
              {%if not field.property_only}
                <div class="tk-configurator__field" data-cy="configurator.field" data-field={field.attr}>
                  <div class="tk-configurator__field-head">
                    <label class="tk-configurator__label">{field.attr}</label>
                    {%if field.required}
                      <span class="tk-configurator__req" title="Required" aria-hidden="true">*</span>
                    {/if}
                    {%if field.uneditable}
                      <span class="muted">locked</span>
                    {/if}
                  </div>
                  {%if control_kind(field) == "textarea"}
                    <textarea
                      class="tk-configurator__control"
                      rows="4"
                      disabled={field.uneditable}
                      required={field.required}
                      placeholder={field.placeholder}
                      aria-label={field.attr}
                      value={Map.get(@values, field.attr, "")}
                      $input={action: :set_value, params: %{attr: field.attr}}
                    ></textarea>
                  {/if}
                  {%if control_kind(field) == "number"}
                    <input
                      class="tk-configurator__control"
                      type="number"
                      step="any"
                      disabled={field.uneditable}
                      required={field.required}
                      placeholder={field.placeholder}
                      aria-label={field.attr}
                      value={Map.get(@values, field.attr, "")}
                      $input={action: :set_value, params: %{attr: field.attr}}
                    />
                  {/if}
                  {%if control_kind(field) == "boolean"}
                    <input
                      type="checkbox"
                      disabled={field.uneditable}
                      checked={Map.get(@values, field.attr) == true}
                      aria-label={field.attr}
                      $change={action: :set_bool, params: %{attr: field.attr}}
                    />
                  {/if}
                  {%if control_kind(field) == "select"}
                    <select
                      class="tk-configurator__control"
                      disabled={field.uneditable}
                      required={field.required}
                      aria-label={field.attr}
                      $change={action: :set_value, params: %{attr: field.attr}}
                    >
                      {%for option <- select_options(field, Map.get(@values, field.attr, ""))}
                        <option value={option} selected={option == Map.get(@values, field.attr, "")}>{option}</option>
                      {/for}
                    </select>
                  {/if}
                  {%if control_kind(field) == "multiselect"}
                    <div class="tk-configurator__checks" role="group" aria-label={field.attr}>
                      {%for option <- field.options}
                        <label>
                          <input
                            type="checkbox"
                            disabled={field.uneditable}
                            checked={in_list?(Map.get(@values, field.attr, []), option)}
                            $change={action: :toggle_multi, params: %{attr: field.attr, option: option}}
                          />
                          {option}
                        </label>
                      {/for}
                    </div>
                  {/if}
                  {%if control_kind(field) == "color"}
                    <input
                      class="tk-configurator__control"
                      type="text"
                      disabled={field.uneditable}
                      placeholder={if(field.placeholder == "", do: "#rrggbb", else: field.placeholder)}
                      aria-label={field.attr}
                      value={Map.get(@values, field.attr, "")}
                      $input={action: :set_value, params: %{attr: field.attr}}
                    />
                  {/if}
                  {%if control_kind(field) == "url"}
                    <input
                      class="tk-configurator__control"
                      type="url"
                      disabled={field.uneditable}
                      required={field.required}
                      placeholder={if(field.placeholder == "", do: "https://", else: field.placeholder)}
                      aria-label={field.attr}
                      value={Map.get(@values, field.attr, "")}
                      $input={action: :set_value, params: %{attr: field.attr}}
                    />
                  {/if}
                  {%if control_kind(field) == "tag-list"}
                    <div class="tk-configurator__tag-row">
                      <div class="tk-configurator__tags">
                        {%for tag <- tags_of(Map.get(@values, field.attr, []))}
                          <span class="tk-configurator__chip">
                            {tag}
                            <button
                              type="button"
                              disabled={field.uneditable}
                              aria-label={"Remove " <> tag}
                              $click={action: :remove_tag, params: %{attr: field.attr, tag: tag}}
                            >
                              ×
                            </button>
                          </span>
                        {/for}
                        <input
                          class="tk-configurator__control"
                          disabled={field.uneditable}
                          placeholder={if(field.placeholder == "", do: "Add tag", else: field.placeholder)}
                          aria-label={field.attr}
                          value={Map.get(@tag_drafts, field.attr, "")}
                          $input={action: :set_tag_draft, params: %{attr: field.attr}}
                          $key_down.enter.prevent_default={action: :tag_key, params: %{attr: field.attr}}
                        />
                      </div>
                    </div>
                  {/if}
                  {%if control_kind(field) == "json"}
                    <textarea
                      class="tk-configurator__control tk-configurator__mono"
                      rows="8"
                      disabled={field.uneditable}
                      required={field.required}
                      placeholder={if(field.placeholder == "", do: "{ }", else: field.placeholder)}
                      aria-label={field.attr}
                      value={Map.get(@values, field.attr, "")}
                      $input={action: :set_value, params: %{attr: field.attr}}
                    ></textarea>
                  {/if}
                  {%if control_kind(field) == "string"}
                    <input
                      class="tk-configurator__control"
                      type="text"
                      disabled={field.uneditable}
                      required={field.required}
                      placeholder={field.placeholder}
                      aria-label={field.attr}
                      value={Map.get(@values, field.attr, "")}
                      $input={action: :set_value, params: %{attr: field.attr}}
                    />
                  {/if}
                  {%if field.description != ""}
                    <p class="muted tk-configurator__hint">{field.description}</p>
                  {/if}
                </div>
              {/if}
            {/for}
            <div class="tk-configurator__actions">
              <button type="submit" data-cy="configurator.apply">Apply</button>
            </div>
          </form>
          <div class="tk-configurator__side">
            <div class="tk-configurator__demo-frame" data-cy="configurator.preview" aria-label="Preview">
              <pre class="tk-configurator__preview-src">{snippet_text(@schema, @values, @slots)}</pre>
            </div>
            <div>
              <div class="tk-configurator__snippet-bar">
                <span class="muted">Snippet</span>
              </div>
              <pre data-cy="configurator.snippet" aria-label="HTML snippet">{snippet_text(@schema, @values, @slots)}</pre>
            </div>
          </div>
        </div>
      {/if}
    </div>
    """
  end

  def init(props, component, _server) do
    src = Map.get(props, :schema_src) || ""

    case normalize_schema(Map.get(props, :schema)) do
      {:ok, schema} ->
        adopt(schema, src, "", false, Map.get(props, :target) || "parent", component)

      {:error, _msg} ->
        put_state(component,
          schema: nil,
          values: %{},
          slots: %{},
          error: "",
          loading: false,
          schema_src: src,
          target: Map.get(props, :target) || "parent"
        )
    end
  end

  # — client actions —

  def action(:set_value, params, component) do
    set_value(component, params.attr, params.event.value)
  end

  def action(:set_bool, params, component) do
    set_value(component, params.attr, params.event.value == true)
  end

  def action(:toggle_multi, params, component) do
    attr = params.attr
    option = params.option
    current = Map.get(component.state.values, attr, [])

    current =
      if is_list(current) do
        current
      else
        []
      end

    next =
      if params.event.value == true do
        if Enum.filter(current, fn item -> item == option end) == [] do
          current ++ [option]
        else
          current
        end
      else
        Enum.filter(current, fn item -> item != option end)
      end

    set_value(component, attr, next)
  end

  # Enter (or comma) commits the tag draft; the draft itself rides $input.
  def action(:tag_key, params, component) do
    if params.event.key == "Enter" or params.event.key == "," do
      draft = Map.get(component.state.tag_drafts, params.attr, "")
      component = add_tag(component, params.attr, draft)

      put_state(component,
        tag_drafts: Map.put(component.state.tag_drafts, params.attr, "")
      )
    else
      component
    end
  end

  def action(:set_tag_draft, params, component) do
    put_state(component,
      tag_drafts: Map.put(component.state.tag_drafts, params.attr, params.event.value)
    )
  end

  def action(:remove_tag, params, component) do
    current = Map.get(component.state.values, params.attr, [])

    current =
      if is_list(current) do
        current
      else
        []
      end

    set_value(
      component,
      params.attr,
      Enum.filter(current, fn item -> item != params.tag end)
    )
  end

  # Lit `apply()`: dispatch the {tag, attributes, slots} snapshot.
  def action(:apply, _params, component) do
    put_action(
      component,
      name: :configurator_apply,
      params: snapshot(component),
      target: component.state.target
    )
  end

  def action(:schema_loaded, params, component) do
    src = component.state.schema_src
    adopt(params.schema, src, "", false, Map.get(component.state, :target) || "parent", component)
  end

  def action(:schema_error, params, component) do
    put_state(component, schema: nil, loading: false, error: params.message)
  end

  def action(_, _params, component), do: component

  # — server commands (one request each, §6.9) —

  def command(:load_schema, params, server) do
    params = HostConfig.from_params!(params)

    case schema_transport().get(Map.get(params, :src)) do
      {:ok, body} ->
        case normalize_schema(body) do
          {:ok, schema} -> put_action(server, :schema_loaded, %{schema: schema})
          {:error, msg} -> put_action(server, :schema_error, %{message: msg})
        end

      {:error, %{status: status}} ->
        put_action(server, :schema_error, %{message: "schema-src failed (" <> int_to_string(status) <> ")"})

      {:error, %{reason: reason}} ->
        put_action(server, :schema_error, %{message: reason})
    end
  end

  # Transport injection seam: the `:catalog` scope map may carry a
  # `transport` module (Support.Http outcome shape) for tests/gallery.
  # Tolerates an unwired scope — the public schema URL needs no host config.
  defp schema_transport do
    Map.get(HostConfig.resolve(:catalog), :transport, Http)
  rescue
    ArgumentError -> Http
  end

  # — public: schema normalization (init runs client-side too — verified ops only) —

  @doc """
  Normalizes a raw schema document into the canonical atom-keyed shape:
  unwraps `{configurator}` / first-of-`{configurators}`, validates
  `tag` + `fields`. Returns `{:ok, schema} | {:error, message}`.
  """
  def normalize_schema(doc) when is_map(doc) do
    doc = unwrap(doc)

    tag = field_str(Map.get(doc, "tag") || Map.get(doc, :tag))

    fields = Map.get(doc, "fields") || Map.get(doc, :fields)

    if tag == "" do
      {:error, "Configurator schema is missing tag"}
    else
      if is_list(fields) do
        {:ok,
         %{
           tag: tag,
           fields: Enum.map(fields, &normalize_field/1),
           slots: normalize_slots(Map.get(doc, "slots") || Map.get(doc, :slots))
         }}
      else
        {:error, "Configurator schema is missing fields"}
      end
    end
  end

  def normalize_schema(_), do: {:error, "Invalid configurator schema"}

  def normalize_field(item) when is_map(item) do
    %{
      attr: field_str(Map.get(item, "attr") || Map.get(item, :attr)),
      type: field_str(Map.get(item, "type") || Map.get(item, :type)),
      required: Map.get(item, "required") == true or Map.get(item, :required) == true,
      uneditable: Map.get(item, "uneditable") == true or Map.get(item, :uneditable) == true,
      default: Map.get(item, "default") || Map.get(item, :default),
      options: field_options(Map.get(item, "options") || Map.get(item, :options)),
      placeholder: field_str(Map.get(item, "placeholder") || Map.get(item, :placeholder)),
      group: field_str(Map.get(item, "group") || Map.get(item, :group)),
      property_only:
        Map.get(item, "propertyOnly") == true or Map.get(item, "property_only") == true,
      description: field_str(Map.get(item, "description") || Map.get(item, :description))
    }
  end

  def normalize_field(_),
    do: %{attr: "", type: "", required: false, uneditable: false, default: nil,
          options: [], placeholder: "", group: "", property_only: false, description: ""}

  def normalize_slots(slots) when is_list(slots), do: Enum.filter(slots, &is_binary/1)
  def normalize_slots(_), do: []

  @doc "Seeds form values from field defaults (type-based when no default). Lit's demoHtml seeding is not supported — the mirror has no HTML parser."
  def seed_values(schema) do
    Map.new(schema.fields, fn field -> {field.attr, seed_value(field)} end)
  end

  def seed_slots(schema) do
    Map.new(schema.slots, fn name -> {name, ""} end)
  end

  # — public: snippet builder (client-safe, verified ops only) —

  @doc "The copyable `<tag attr=\"value\">` snippet (Lit `buildSnippet`)."
  def snippet_text(schema, values, slots) do
    attrs =
      schema.fields
      |> Enum.filter(fn field -> not field.property_only end)
      |> Enum.map(fn field -> attr_pair(field, Map.get(values, field.attr)) end)
      |> Enum.filter(fn part -> part != nil end)
      |> Enum.join(" ")

    inner = slots_inner(slots)

    if inner == "" do
      "<" <> schema.tag <> attrs_part(attrs) <> "></" <> schema.tag <> ">"
    else
      "<" <> schema.tag <> attrs_part(attrs) <> ">\n" <> indent(inner) <> "\n</" <> schema.tag <> ">"
    end
  end

  # — public: control selection (template) —

  @doc "Which control template renders for a field: text/textarea/number/boolean/select/multiselect/color/url/tag-list/json."
  def control_kind(field) do
    case field.type do
      "text" -> "textarea"
      "number" -> "number"
      "boolean" -> "boolean"
      "select" -> "select"
      "multiselect" -> "multiselect"
      "color" -> "color"
      "url" -> "url"
      "tag-list" -> "tag-list"
      "json" -> "json"
      _ -> "string"
    end
  end

  @doc "Select options with the current value admitted when missing (Lit `selectOptions`)."
  def select_options(field, value) do
    options = field.options

    if is_binary(value) and value != "" and not in_list?(options, value) do
      [value] ++ options
    else
      options
    end
  end

  @doc "Tag chips of a tag-list value (non-list junk renders as no chips)."
  def tags_of(value) when is_list(value), do: Enum.filter(value, &is_binary/1)
  def tags_of(_), do: []

  @doc "List membership (public: template-called for multiselect checked state)."
  def in_list?(list, item) do
    Enum.filter(list, fn entry -> entry == item end) != []
  end

  # — internals (client-reachable: verified op set) —

  defp adopt(schema, src, error, loading, target, component) do
    put_state(component,
      schema: schema,
      values: seed_values(schema),
      slots: seed_slots(schema),
      tag_drafts: %{},
      error: error,
      loading: loading,
      schema_src: src,
      target: target
    )
  end

  defp set_value(component, attr, value) do
    current = Map.get(component.state.values, attr)

    if current == value do
      component
    else
      values = Map.put(component.state.values, attr, value)

      component
      |> put_state(values: values)
      |> put_action(
        name: :configurator_change,
        params: snapshot(put_state(component, values: values)),
        target: component.state.target
      )
    end
  end

  defp add_tag(component, attr, raw) do
    tag = raw |> String.replace(",", "") |> String.replace(" ", "")

    if tag == "" do
      component
    else
      current = Map.get(component.state.values, attr, [])

      current =
        if is_list(current) do
          current
        else
          []
        end

      if in_list?(current, tag) do
        component
      else
        set_value(component, attr, current ++ [tag])
      end
    end
  end

  defp snapshot(component) do
    %{
      tag: (component.state.schema || %{}) |> Map.get(:tag) || "",
      attributes: component.state.values,
      slots: component.state.slots
    }
  end

  defp attr_pair(field, value) do
    if field.type == "boolean" do
      if value == true do
        field.attr
      else
        nil
      end
    else
      if omit?(value) do
        nil
      else
        field.attr <> "=\"" <> escape_attr(stringify_value(value)) <> "\""
      end
    end
  end

  defp omit?(value) do
    value == nil or value == "" or value == [] or value == %{}
  end

  defp stringify_value(value) do
    if is_list(value) do
      Enum.join(value, ",")
    else
      if is_binary(value) do
        value
      else
        if value == true do
          "true"
        else
          if value == false do
            "false"
          else
            if value == nil do
              ""
            else
              String.Chars.to_string(value)
            end
          end
        end
      end
    end
  end

  defp escape_attr(value) do
    value
    |> String.replace("&", "&amp;")
    |> String.replace("\"", "&quot;")
    |> String.replace("<", "&lt;")
  end

  defp slots_inner(slots) do
    slots
    |> Map.values()
    |> Enum.filter(fn html -> html != "" end)
    |> Enum.join("")
  end

  defp indent(text) do
    text
    |> String.split("\n")
    |> Enum.map(fn line -> if line != "", do: "  " <> line, else: line end)
    |> Enum.join("\n")
  end

  defp attrs_part(""), do: ""
  defp attrs_part(attrs), do: " " <> attrs

  defp seed_value(field) do
    if field.default != nil and field.default != "" do
      field.default
    else
      case field.type do
        "boolean" -> false
        "multiselect" -> []
        "tag-list" -> []
        _ -> ""
      end
    end
  end

  defp unwrap(doc) do
    configurator = Map.get(doc, "configurator") || Map.get(doc, :configurator)

    if is_map(configurator) do
      unwrap(configurator)
    else
      configurators = Map.get(doc, "configurators") || Map.get(doc, :configurators)

      if is_list(configurators) and configurators != [] do
        unwrap(Enum.at(configurators, 0) || %{})
      else
        doc
      end
    end
  end

  defp field_str(value) when is_binary(value), do: value
  defp field_str(_), do: ""

  defp field_options(options) when is_list(options) do
    Enum.filter(options, fn option -> is_binary(option) end)
  end

  defp field_options(_), do: []

  defp int_to_string(value), do: String.Chars.to_string(value)
end
