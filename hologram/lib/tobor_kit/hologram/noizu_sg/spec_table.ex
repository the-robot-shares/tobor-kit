defmodule ToborKit.Hologram.Sg.SpecTable do
  @moduledoc """
  Mirror of `<noizu-sg-spec-table>` (contract class A — stateless render-only).

  `rows` is a list of `{key, value}` maps (string- or atom-keyed; non-map
  items render as the value with an empty key). Cells are interpolated text
  only — Hologram escapes interpolation, matching the Lit "never HTML" rule.

  Backend: None.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  prop :rows, :list, default: []
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-sg-spec-table", @class)}>
      <table class="tk-sg-spec-table__table" data-cy="sg.spec">
        <tbody>
          {%for row <- rows_view(@rows)}
            <tr>
              <th scope="row">{Map.get(row, :key)}</th>
              <td>{Map.get(row, :value)}</td>
            </tr>
          {/for}
        </tbody>
      </table>
    </div>
    """
  end

  @doc """
  Row normalizer (port of the Lit `asRows`/`cellText`): accepts string- or
  atom-keyed maps and non-map items; coerces cells to strings, `nil` → `""`.
  """
  def rows_view(rows) when is_list(rows) do
    Enum.map(rows, fn
      row when is_map(row) ->
        %{key: cell_text(fetch(row, "key", :key)), value: cell_text(fetch(row, "value", :value))}

      item ->
        %{key: "", value: cell_text(item)}
    end)
  end

  def rows_view(_), do: []

  # public: template-called functions transpile client-side, and client
  # codegen calls helpers by name — private fns are not guaranteed to ship.
  @doc "String-then-atom key lookup (template-passed maps arrive string-keyed)."
  def fetch(map, string_key, atom_key) do
    case Map.get(map, string_key) do
      nil -> Map.get(map, atom_key)
      value -> value
    end
  end

  @doc "Cell text coercion — `nil` → `\"\"`, non-strings stringified (Lit `cellText`)."
  def cell_text(nil), do: ""
  def cell_text(value) when is_binary(value), do: value
  def cell_text(value), do: to_string(value)
end
