defmodule ToborKit.Hologram.Sg.CardGrid do
  @moduledoc """
  Mirror of `<noizu-sg-card-grid>` (contract class A — stateless render-only).

  Default slot holds the cards. `columns` clamps to a positive integer
  (default 3) and projects as the `--sg-columns` custom property.

  Backend: None.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  prop :columns, :integer, default: 3
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-sg-card-grid", @class)}>
      <div
        class="tk-sg-card-grid__grid"
        data-cy="sg.grid"
        data-columns={Integer.to_string(resolved_columns(@columns))}
        style={"--sg-columns: #{Integer.to_string(resolved_columns(@columns))}"}
      >
        <slot />
      </div>
    </div>
    """
  end

  @doc "Columns clamp — non-positive/non-integer input falls back to 3 (Lit `resolvedColumns`)."
  def resolved_columns(columns) when is_integer(columns) and columns > 0, do: columns
  def resolved_columns(_), do: 3
end
