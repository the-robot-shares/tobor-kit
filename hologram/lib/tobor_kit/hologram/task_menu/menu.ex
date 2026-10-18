defmodule ToborKit.Hologram.TaskMenu.Menu do
  @moduledoc """
  Mirror of `<tobor-task-menu>` (registry: `task-menu` family) — the
  task/context menu over the server-dressed `GET /mcp/tools` inventory.
  Contract class B (stateful): open/confirm state + Escape-to-close
  (PORTING.md §1).

  The overlay (labels, grouping, order, hidden, confirm) was applied
  server-side precisely so this element and its Swift twin cannot drift;
  the menu never re-dresses anything client-side. `confirm: true` tools get
  a two-step inline confirmation before the select event fires.

  Lit event `tobor-task-select` `{tool}` → host action
  `:tobor_task_select` `params: %{tool: <normalized tool map>}` dispatched
  with `target: @target` (default `"parent"`). Selecting a tool does NOT
  invoke it — it names an MCP tool the guide should prefer for the next
  turn; the host decides what to do with the selection.

  Registry note: `tobor-task-menu` has no `cy:` hooks in `registry.yaml`;
  the Lit source's `data-testid` attributes are copied verbatim as the
  test contract (they are the only hooks the Lit cypress suite uses).
  """

  use Hologram.Component

  alias ToborKit.Hologram.Data.Tools

  prop :inventory, :map, default: nil
  prop :open, :boolean, default: false
  prop :target, :string, default: "parent"

  def template do
    ~HOLO"""
    <div class="tk tk-task-menu">
      <button
        class="tk-task-menu__trigger"
        type="button"
        data-testid="task-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={flag(@open)}
        $click={:toggle_open}
      >
        Tasks ▴
      </button>
      {%if @open}
        <div
          class="tk-task-menu__panel"
          role="menu"
          data-testid="task-menu-panel"
          $key_down.escape={:close}
        >
          {%if @degraded != []}
            <div class="notice tk-task-menu__degraded" data-testid="task-menu-degraded">
              {%for d <- @degraded}
                {%if d.server}
                  <div>{d.server} unreachable</div>
                {%else}
                  <div data-testid="task-menu-degraded-unidentified">A tool server is unreachable</div>
                {/if}
              {/for}
            </div>
          {/if}
          {%if @confirming_name}
            <div class="tk-task-menu__confirm-text" data-testid="task-confirm-text">
              Run “{confirm_label(@confirming_name, @tools)}”? This action is not read-only.
            </div>
            <div class="tk-task-menu__confirm-row">
              <button type="button" data-testid="task-confirm-yes" $click={:confirm_yes}>
                Run it
              </button>
              <button type="button" $click={:cancel_confirm}>Cancel</button>
            </div>
          {/if}
          {%for tool <- @tools}
            {%if tool.name != @confirming_name}
              <button
                type="button"
                class="tk-task-menu__item"
                role="menuitem"
                data-tool={tool.name}
                $click={action: :tool_clicked, params: %{tool_name: tool.name}}
              >
                {tool.label}{%if tool.confirm}<span class="tk-task-menu__warn"> ⚠</span>{/if}
              </button>
            {/if}
          {/for}
          {%if @tools == []}
            <div class="muted tk-task-menu__empty" data-testid="task-menu-empty">No tasks available.</div>
          {/if}
        </div>
      {/if}
    </div>
    """
  end

  def init(props, component, _server) do
    inventory = Tools.normalize_inventory(props.inventory)

    put_state(component,
      open: props.open == true,
      target: props.target,
      confirming_name: nil,
      tools: inventory.tools,
      degraded: inventory.degraded
    )
  end

  # -- actions (client; transpiler-verified ops only — PORTING.md §6.1) --

  def action(:toggle_open, _params, component) do
    open = if component.state.open, do: false, else: true
    put_state(component, open: open, confirming_name: nil)
  end

  def action(:close, _params, component) do
    put_state(component, open: false, confirming_name: nil)
  end

  def action(:cancel_confirm, _params, component) do
    put_state(component, :confirming_name, nil)
  end

  # Confirm-capable tools confirm inline first (Lit `#toolClicked`).
  def action(:tool_clicked, %{tool_name: name}, component) do
    tool = Tools.find_tool(component.state.tools, name)

    if tool && tool.confirm do
      put_state(component, :confirming_name, name)
    else
      select(component, tool)
    end
  end

  def action(:confirm_yes, _params, component) do
    select(component, Tools.find_tool(component.state.tools, component.state.confirming_name))
  end

  # Emits the host event and closes (Lit `#select`). `tool` is nil-safe.
  def select(component, nil), do: put_state(component, open: false, confirming_name: nil)

  def select(component, tool) do
    component
    |> put_action(
      name: :tobor_task_select,
      target: component.state.target,
      params: %{tool: tool}
    )
    |> put_state(open: false, confirming_name: nil)
  end

  # -- template helpers (public: client codegen calls publics by name) --

  @doc "Label of the tool currently in the inline-confirm step."
  @spec confirm_label(String.t() | nil, [Tools.tool()]) :: String.t()
  def confirm_label(nil, _tools), do: ""

  def confirm_label(name, tools) do
    case Tools.find_tool(tools, name) do
      nil -> name
      tool -> tool.label
    end
  end

  @doc "Boolean prop to verbatim string attr (aria-expanded etc.)."
  @spec flag(boolean) :: String.t()
  def flag(true), do: "true"
  def flag(_), do: "false"
end
