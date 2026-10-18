defmodule ToborKit.Hologram.ToolList.List do
  @moduledoc """
  Mirror of `<tobor-tool-list>` (registry: `tool-list` family) — browsable
  view over the server-dressed `GET /mcp/tools` inventory. Contract class B
  (stateful for the `:target` forwarding + normalized snapshot init; no
  internal toggle state — the Lit element is purely presentational).

  The server has already applied the guide's allow/deny globs and the
  `mcp.menu` overlay; this mirror renders the response VERBATIM. In
  particular `degraded[]` is surfaced prominently — a short tool list
  because a server is down is information, not a rendering accident to hide.

  Lit event `tobor-tool-select` `{tool}` → item binding
  `$click={action: :tobor_tool_select, params: %{tool: tool}, target: @target}`
  (host-forwarding longhand binding, PORTING.md §1 class B).

  Registry note: `tobor-tool-list` has no `cy:` hooks in `registry.yaml`;
  the Lit source's `data-testid` attributes are copied verbatim as the test
  contract.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Data.Tools

  prop :inventory, :map, default: nil
  prop :show_descriptions, :boolean, default: true
  prop :target, :string, default: "parent"

  def template do
    ~HOLO"""
    <div class="tk tk-tool-list">
      {%if @unavailable}
        <div class="none tk-tool-list__none" data-testid="tools-unavailable">Tools unavailable.</div>
      {%else}
        {%if @degraded != []}
          <div class="notice tk-tool-list__degraded" data-testid="degraded-servers">
            <strong>Some tool servers are unreachable:</strong>
            <ul>
              {%for d <- @degraded}
                {%if d.server}
                  <li data-server={d.server}>{d.server}{%if d.error != ""}<span> — {d.error}</span>{/if}</li>
                {%else}
                  <li data-testid="degraded-unidentified">A tool server is unreachable</li>
                {/if}
              {/for}
            </ul>
          </div>
        {/if}
        {%if @groups == []}
          <div class="none tk-tool-list__none" data-testid="tools-empty">
            No tools are exposed for this guide.
          </div>
        {/if}
        {%for group <- @groups}
          <section class="tk-tool-list__group" data-group={group.id}>
            <p class="tk-tool-list__group-label">{group.label}</p>
            {%for tool <- group.tools}
              <button
                type="button"
                class="tk-tool-list__tool"
                data-tool={tool.name}
                $click={action: :tobor_tool_select, params: %{tool: tool}, target: @target}
              >
                <span>{tool.label}</span>
                {%if tool.read_only}<span class="tk-tool-list__badge">read-only</span>{/if}
                {%if tool.confirm}<span class="tk-tool-list__badge tk-tool-list__badge--confirm">confirm</span>{/if}
                <span class="tk-tool-list__name">{tool.name}</span>
                {%if @show_descriptions}
                  {%if tool.description != ""}
                    <span class="tk-tool-list__desc">{tool.description}</span>
                  {/if}
                {/if}
              </button>
            {/for}
          </section>
        {/for}
      {/if}
    </div>
    """
  end

  def init(props, component, _server) do
    inventory = Tools.normalize_inventory(props.inventory)

    put_state(component,
      target: props.target,
      show_descriptions: props.show_descriptions != false,
      unavailable: is_nil(props.inventory),
      groups: Tools.group_tools(inventory.tools, Tools.label_map(inventory)),
      degraded: inventory.degraded
    )
  end

  @doc "Boolean prop to verbatim string attr."
  @spec flag(boolean) :: String.t()
  def flag(true), do: "true"
  def flag(_), do: "false"
end
