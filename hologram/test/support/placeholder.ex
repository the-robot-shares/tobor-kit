defmodule ToborKit.Hologram.TestSupport.Placeholder do
  @moduledoc """
  Wave-0 render-harness placeholder — the canonical stateless-mirror shape
  (PORTING.md contract class A). Renders a `.tk tk-placeholder` root with a
  registry-style `data-cy` hook; real component mirrors replace this in
  family waves.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  prop :title, :string, default: "placeholder"
  prop :items, :list, default: []
  prop :config, :map, default: %{}
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-placeholder", @class)} data-cy="gallery.placeholder">
      <p class="tk-placeholder__title">{@title}</p>
      {%for item <- @items}
        <span class="tk-placeholder__item" data-cy={config_cy(@config, item)}>{item}</span>
      {/for}
    </div>
    """
  end

  # public: templates must only call public functions (client codegen calls
  # locals by name; private fns are not guaranteed to ship)
  def config_cy(config, item) do
    case Map.get(config, "item_cy_prefix") do
      nil -> "gallery.placeholder.item"
      prefix -> "#{prefix}.#{item}"
    end
  end
end
