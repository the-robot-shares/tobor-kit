defmodule ToborKit.Hologram.Mcp.Config do
  @moduledoc """
  `<tobor-mcp-config>` mirror — MCP transport / server params form (contract
  class B).

  Ported from `web/src/components/mcp-config/tobor-mcp-config.ts`. Emits
  `:config_change` on save (Lit `config-change {url, transport, extras?}`).
  The host validates and persists; this mirror carries no secrets and does
  not connect to MCP servers. `extras` is prop-only, non-secret, and passed
  through on save when nonempty.

  Backend: None. Host owns data flow.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  @transports ["stdio", "http", "sse"]

  # Server URL (http/sse) or command path (stdio). Host validates.
  prop :url, :string, default: ""

  # `stdio` | `http` | `sse` (invalid values clamp to `http` in `init/3`).
  prop :transport, :string, default: "http"

  # Optional non-secret extras — never tokens, env, or Authorization headers.
  prop :extras, :any, default: nil

  # Host-notification target.
  prop :target, :string, default: "parent"

  prop :class, :string, default: ""

  def init(props, component, _server) do
    put_state(component,
      url: props.url || "",
      transport: normalize_transport(props.transport),
      extras: props.extras,
      target: props.target || "parent"
    )
  end

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-mcp-config", @class)}>
      <form class="tk-mcp-config__form" data-cy="mcp.config" $submit={:save}>
        <label class="tk-mcp-config__field">
          <span>URL / command</span>
          <input
            class="tk-mcp-config__url"
            name="url"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder={placeholder(@transport)}
            aria-label="MCP URL or command"
            value={@url}
            $input={:set_url}
          />
        </label>
        <label class="tk-mcp-config__field">
          <span>Transport</span>
          <select
            class="tk-mcp-config__transport"
            name="transport"
            aria-label="MCP transport"
            $change={:set_transport}
          >
            {%for value <- transports()}
              <option value={value} selected={value == @transport}>{value}</option>
            {/for}
          </select>
        </label>
        <button class="tk-mcp-config__save" type="submit" data-cy="mcp.save">Save</button>
      </form>
    </div>
    """
  end

  # -- public template helpers ------------------------------------------

  @doc "Lit `MCP_TRANSPORTS`."
  def transports, do: @transports

  @doc "Lit `normalizeTransport`: anything but stdio/sse is `http`."
  def normalize_transport(value) do
    if value in @transports do
      value
    else
      "http"
    end
  end

  @doc "Lit placeholder: stdio expects a command path, http/sse a URL."
  def placeholder(transport) do
    if transport == "stdio" do
      "/usr/local/bin/mcp-server"
    else
      "https://mcp.example.test/mcp"
    end
  end

  @doc "Lit `extrasForEvent`: drop empty extras so save stays {url, transport}."
  def extras_for_event(extras) do
    case extras do
      map when is_map(map) and map != %{} -> map
      _ -> nil
    end
  end

  # -- actions (client-side; regex-free) ---------------------------------

  def action(:set_url, params, component) do
    put_state(component, :url, params.event.value)
  end

  def action(:set_transport, params, component) do
    put_state(component, :transport, normalize_transport(params.event.value))
  end

  def action(:save, _params, component) do
    save(component)
  end

  # Host-forwarded actions loop back onto this component when no explicit
  # target resolves — Lit CustomEvents with no listener drop silently.
  def action(_name, _params, component) do
    component
  end

  @doc "Lit `#onSubmit`: normalize transport, trim url, attach nonempty extras."
  def save(component) do
    state = component.state
    transport = normalize_transport(state.transport)

    params =
      %{url: String.trim(state.url || ""), transport: transport}
      |> maybe_add_extras(extras_for_event(state.extras))

    put_action(component, name: :config_change, target: state.target, params: params)
  end

  defp maybe_add_extras(params, nil), do: params
  defp maybe_add_extras(params, extras), do: Map.put(params, :extras, extras)
end
