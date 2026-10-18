defmodule ToborKit.Hologram.Mcp.Domain do
  @moduledoc """
  Mirror of `<tobor-mcp-domain>` (registry: `mcp-domain` family) — tri-state
  visibility (`visible | discoverable | disabled`) per MCP tool, with a
  composed preview of currently `visible` tools. Contract class B.

  Properties down, events up: the host persists `tool-visibility-change`.

  Lit event `tool-visibility-change` `{name, visibility}` → host action
  `:tool_visibility_change` `params: %{name: ..., visibility: ...}`
  dispatched with `target: @target`.

  Preview composition: the Lit element composes `<tobor-tool-list>`; the
  mirror composes `ToborKit.Hologram.ToolList.List` (passing `preview_cid`
  + this mirror's `:target`, so preview tool-selects forward to the same
  host target as visibility changes).

  Divergences (PORTING.md §4 cadence):

    * the Lit regex-derived select id (`vis-<sanitized name>`) is computed
      server-side in init/3 — regex is not client-transpilable;
    * Lit swallows `tobor-tool-select` on the preview (`stopPropagation`);
      the mirror forwards preview selects to `@target` (longhand bindings
      cannot be silently swallowed) — hosts that don't implement
      `:tobor_tool_select` are unaffected.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Data.Tools
  alias ToborKit.Hologram.ToolList.List, as: ToolList

  @visibilities [:visible, :discoverable, :disabled]

  prop :tools, :list, default: []
  prop :inventory, :map, default: nil
  prop :target, :string, default: "parent"
  prop :preview_cid, :string, default: "mcp-domain-tool-preview"

  def template do
    ~HOLO"""
    <div class="tk tk-mcp-domain">
      <div class="tk-mcp-domain__stack" data-cy="mcp.domain">
        {%if @rows != []}
          <ul class="tk-mcp-domain__tools">
            {%for row <- @rows}
              <li
                class="tk-mcp-domain__tool"
                data-cy="mcp.tool"
                data-tool={row.name}
                data-visibility={row.visibility}
              >
                <span>
                  {%if row.label != row.name}
                    <span class="tk-mcp-domain__label">{row.label}</span>
                  {/if}
                  <span class="tk-mcp-domain__name">{row.name}</span>
                </span>
                <label>
                  <span class="muted">Visibility</span>
                  <select
                    id={row.select_id}
                    aria-label={"Visibility for " <> row.name}
                    $change={action: :set_visibility, params: %{name: row.name}}
                  >
                    {%for opt <- @visibilities}
                      <option value={opt} selected={opt == row.visibility}>{caption(opt)}</option>
                    {/for}
                  </select>
                </label>
              </li>
            {/for}
          </ul>
        {%else}
          <p class="muted tk-mcp-domain__empty">No tools.</p>
        {/if}
        <p class="tk-mcp-domain__preview-label">Visible tools</p>
        <ToolList
          cid={@preview_cid}
          inventory={@preview}
          target={@target}
        />
      </div>
    </div>
    """
  end

  def init(props, component, _server) do
    inventory = Tools.normalize_inventory(props.inventory)
    labels = Tools.label_map(inventory)
    rows = normalize_domain_tools(props.tools, labels)

    put_state(component,
      target: props.target,
      visibilities: @visibilities,
      rows: rows,
      inventory: inventory,
      preview: Tools.visible_inventory(rows, inventory)
    )
  end

  # -- actions (client; transpiler-verified ops only — PORTING.md §6.1) --

  def action(:set_visibility, %{name: name, event: event}, component) do
    visibility = normalize_visibility(event.value)
    rows = Tools.set_row_visibility(component.state.rows, name, visibility)

    component
    |> put_action(
      name: :tool_visibility_change,
      target: component.state.target,
      params: %{name: name, visibility: visibility}
    )
    |> put_state(rows: rows, preview: Tools.visible_inventory(rows, component.state.inventory))
  end

  # -- init-only normalization (server-side; regex welcome here) --

  @doc "Clamps visibility to the tri-state union (Lit `normalizeVisibility`)."
  @spec normalize_visibility(any) :: :visible | :discoverable | :disabled
  def normalize_visibility(value) do
    case value do
      :visible -> :visible
      :discoverable -> :discoverable
      :disabled -> :disabled
      "visible" -> :visible
      "discoverable" -> :discoverable
      "disabled" -> :disabled
      _ -> :disabled
    end
  end

  @doc "Normalizes the `{name, visibility}` rows (drops rows without a name)."
  @spec normalize_domain_tools(any, %{optional(String.t()) => String.t()}) :: [map]
  def normalize_domain_tools(tools, labels) when is_list(tools) do
    for row <- tools, is_map(row) do
      name = String.trim(Tools.to_s(Tools.fetch(row, :name)))

      if name != "" do
        label = Map.get(labels, name) || name

        %{
          name: name,
          label: label,
          visibility: normalize_visibility(Tools.fetch(row, :visibility)),
          select_id: "vis-" <> String.replace(name, ~r/[^a-zA-Z0-9_-]/, "-")
        }
      else
        nil
      end
    end
    |> Enum.reject(&is_nil/1)
  end

  def normalize_domain_tools(_, _), do: []

  @doc "Option caption (Lit `caption/1`)."
  @spec caption(atom) :: String.t()
  def caption(:visible), do: "Visible"
  def caption(:discoverable), do: "Discoverable"
  def caption(:disabled), do: "Disabled"
end
