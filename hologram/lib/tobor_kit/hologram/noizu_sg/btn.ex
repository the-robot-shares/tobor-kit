defmodule ToborKit.Hologram.Sg.Btn do
  @moduledoc """
  Mirror of `<noizu-sg-btn>` (contract class A — stateless render-only).

  Lit mechanism replaced: the `sg-click` CustomEvent becomes a host-side
  `:sg_click` action dispatched to the `:target` (`"parent"` by default).
  Bind host behavior by handling `:sg_click` in the containing stateful
  component/page; the disabled button never fires (native `disabled`).

  Default slot renders the label via `<slot />`.

  Backend: None. Host owns the click behavior.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  prop :variant, :string, default: "primary"
  prop :size, :string, default: "md"
  prop :disabled, :boolean, default: false
  prop :type, :string, default: "button"
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-sg-btn", @class)}>
      <button
        class="tk-sg-btn__button"
        data-cy="sg.btn"
        data-variant={resolved_variant(@variant)}
        data-size={resolved_size(@size)}
        type={resolved_type(@type)}
        disabled={@disabled}
        $click={action: :sg_click, target: @target}
      ><slot /></button>
    </div>
    """
  end

  @doc "Variant clamp — invalid input falls back to `primary` (Lit `VARIANTS`)."
  def resolved_variant(variant) when variant in ["primary", "secondary", "ghost", "danger"],
    do: variant

  def resolved_variant(_), do: "primary"

  @doc "Size clamp — invalid input falls back to `md` (Lit `SIZES`)."
  def resolved_size(size) when size in ["sm", "md", "lg"], do: size
  def resolved_size(_), do: "md"

  @doc "Type clamp — invalid input falls back to `button` (Lit `TYPES`)."
  def resolved_type(type) when type in ["button", "submit"], do: type
  def resolved_type(_), do: "button"
end
