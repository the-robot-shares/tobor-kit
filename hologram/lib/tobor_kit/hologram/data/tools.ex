defmodule ToborKit.Hologram.Data.Tools do
  @moduledoc """
  Tool-inventory shape for the tool-list / task-menu / mcp-domain mirrors
  (port of the `Tool` / `ToolGroup` / `DegradedServer` / `ToolInventory`
  shapes from `web/src/types.ts`).

  The server has already applied the guide's allow/deny globs and the
  `mcp.menu` overlay; mirrors render the inventory VERBATIM — they never
  re-dress anything client-side.

  Template-passed map props arrive STRING-keyed (PORTING.md §6.2), so the
  normalize functions accept both string- and atom-keyed rows.

  Client-safety split (PORTING.md §6.1):

    * normalize + `visible_inventory` + `set_row_visibility` are called from
      `action/3` (client) — they stay on the transpiler-verified op set
      (comprehensions, `in`, `Map.get`, `String.split`);
    * `group_tools` / `group_ids` are init/3-only helpers (server-side);
      they still stick to the verified set so the whole module is
      client-transpilable.
  """

  @typedoc "Normalized tool row."
  @type tool :: %{
          name: String.t(),
          label: String.t(),
          description: String.t(),
          group: String.t(),
          confirm: boolean,
          read_only: boolean,
          server: String.t() | nil
        }

  @typedoc "Normalized degraded-server row."
  @type degraded :: %{server: String.t() | nil, error: String.t() | nil}

  @typedoc "Normalized group row."
  @type group :: %{id: String.t(), label: String.t()}

  @typedoc "Normalized inventory."
  @type inventory :: %{groups: [group], tools: [tool], degraded: [degraded]}

  @doc "Empty inventory (Lit `inventory ?? {groups: [], tools: [], degraded: []}`)."
  @spec empty_inventory :: inventory()
  def empty_inventory do
    %{groups: [], tools: [], degraded: []}
  end

  @doc """
  Reads a possibly-string-keyed map prop. Template-passed literals arrive
  string-keyed (PORTING.md §6.2); hosts building maps in Elixir pass atoms.
  """
  @spec fetch(map, atom) :: any
  def fetch(map, key) when is_map(map) do
    Map.get(map, key) || Map.get(map, Atom.to_string(key))
  end

  @doc "String coercion for inventory fields (nil-safe)."
  @spec to_s(any) :: String.t()
  def to_s(value) when is_binary(value), do: value
  def to_s(value) when is_integer(value), do: Integer.to_string(value)
  def to_s(_), do: ""

  @doc "Normalizes an inventory prop (nil / malformed → empty inventory)."
  @spec normalize_inventory(any) :: inventory()
  def normalize_inventory(nil), do: empty_inventory()

  def normalize_inventory(inv) when is_map(inv) do
    %{
      groups: normalize_groups(fetch(inv, :groups) || []),
      tools: normalize_tools(fetch(inv, :tools) || []),
      degraded: normalize_degraded(fetch(inv, :degraded) || [])
    }
  end

  def normalize_inventory(_), do: empty_inventory()

  @doc "Normalizes the `groups` list."
  @spec normalize_groups(any) :: [group()]
  def normalize_groups(groups) when is_list(groups) do
    for g <- groups, is_map(g) do
      id = to_s(fetch(g, :id))
      label = fetch(g, :label) || id
      %{id: id, label: to_s(label)}
    end
  end

  def normalize_groups(_), do: []

  @doc "Normalizes the `tools` list (drops rows without a name, like the Lit consumers)."
  @spec normalize_tools(any) :: [tool()]
  def normalize_tools(tools) when is_list(tools) do
    for t <- tools, is_map(t), name = to_s(fetch(t, :name)), name != "" do
      %{
        name: name,
        label: to_s(fetch(t, :label) || name),
        description: to_s(fetch(t, :description) || ""),
        group: to_s(fetch(t, :group) || ""),
        confirm: fetch(t, :confirm) == true,
        read_only: fetch(t, :read_only) == true,
        server: fetch(t, :server)
      }
    end
  end

  def normalize_tools(_), do: []

  @doc "Normalizes the `degraded` list."
  @spec normalize_degraded(any) :: [degraded()]
  def normalize_degraded(degraded) when is_list(degraded) do
    for d <- degraded, is_map(d) do
      %{server: fetch(d, :server), error: to_s(fetch(d, :error) || "")}
    end
  end

  def normalize_degraded(_), do: []

  @doc """
  Labels map for a normalized inventory: `%{"<group id>" => "<label>"}`.
  Init/3-only convenience for `group_tools/2`.
  """
  @spec label_map(inventory()) :: %{optional(String.t()) => String.t()}
  def label_map(inventory) do
    for g <- inventory.groups, into: %{}, do: {g.id, g.label}
  end

  @doc """
  Groups normalized tools by `group`, preserving first-seen group order,
  with labels resolved from the inventory's group list (Lit renders one
  `<section class="group">` per group; computed once in init/3).
  """
  @spec group_tools([tool()], %{optional(String.t()) => String.t()}) :: [
          %{id: String.t(), label: String.t(), tools: [tool()]}
        ]
  def group_tools(tools, labels) do
    for id <- group_ids(tools) do
      %{id: id, label: Map.get(labels, id) || id, tools: for(t <- tools, t.group == id, do: t)}
    end
  end

  @doc "First-seen group ids in order."
  @spec group_ids([tool()]) :: [String.t()]
  def group_ids(tools) do
    do_uniq(for t <- tools, do: t.group)
  end

  def do_uniq(ids), do: do_uniq(ids, [])

  def do_uniq([], acc), do: Enum.reverse(acc)

  def do_uniq([id | rest], acc) do
    if id in acc, do: do_uniq(rest, acc), else: do_uniq(rest, [id | acc])
  end

  @doc "Tool lookup by name (client-safe comprehension — used from action/3)."
  @spec find_tool([tool()], String.t()) :: tool() | nil
  def find_tool(tools, name) do
    case for t <- tools, t.name == name, do: t do
      [tool | _] -> tool
      [] -> nil
    end
  end

  @doc """
  Client-safe row update for the mcp-domain mirror's visibility action:
  replaces `visibility` on the named row, leaves the rest untouched.
  """
  @spec set_row_visibility([map], String.t(), atom) :: [map]
  def set_row_visibility(rows, name, visibility) do
    for row <- rows do
      if row.name == name, do: %{row | visibility: visibility}, else: row
    end
  end

  @doc "Names of rows currently marked `:visible` (client-safe)."
  @spec visible_names([map]) :: [String.t()]
  def visible_names(rows) do
    for row <- rows, row.visibility == :visible, do: row.name
  end

  @doc """
  Inventory of tools currently marked `visible` — the preview the
  mcp-domain mirror composes (port of `mcp-domain/types.ts`
  `visibleInventory`). Falls back to a synthetic single-group inventory
  when the host supplied no dressed inventory.
  """
  @spec visible_inventory([map], any) :: inventory()
  def visible_inventory(rows, inventory) do
    inv = normalize_inventory(inventory)
    visible = visible_names(rows)

    if inv.tools == [] and inv.groups == [] and rows != [] do
      # no dressed inventory supplied: synthesize one flat group from the rows
      tools =
        for row <- rows, row.name in visible do
          %{name: row.name, label: Map.get(row, :label) || row.name, group: "visible",
           confirm: false, read_only: false, description: ""}
        end

      groups = if tools == [], do: [], else: [%{id: "visible", label: "visible"}]
      %{groups: groups, tools: tools, degraded: inv.degraded}
    else
      tools = for t <- inv.tools, t.name in visible, do: t
      group_ids = for t <- tools, do: t.group
      groups = for g <- inv.groups, g.id in group_ids, do: g

      %{groups: groups, tools: tools, degraded: inv.degraded}
    end
  end
end
