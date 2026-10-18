defmodule ToborKit.Hologram.FooterBrand.Brand do
  @moduledoc """
  Mirror of `<noizu-footer-brand>` (contract class A — stateless
  render-only). One-line "made by" attribution:
  `A The Robot Lives Joint` with the brand name as a link. Presentational
  only — no events, no actions, no `cid` requirement; hosts bind nothing
  because there is nothing to bind (the anchor navigates natively).

  Backend: None. Host-only presentational island.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  prop :href, :string, default: "https://derobot.is"
  prop :target, :string, default: ""
  prop :brand, :string, default: "The Robot Lives"
  prop :prefix, :string, default: "A"
  prop :suffix, :string, default: "Joint"
  prop :theme, :string, default: "dark"
  prop :palette, :string, default: "default"
  prop :align, :string, default: "center"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-footer-brand", @class)}>
      <p class="tk-footer-brand__line" data-cy="footer-brand-root" data-theme={theme(@theme)} data-palette={palette(@palette)} data-align={align(@align)}>
        {line_prefix(@prefix)}<a class="tk-footer-brand__link" data-cy="footer-brand-link" href={@href} target={target_attr(@target)} rel={rel_attr(@target)}>{@brand}</a>{line_suffix(@suffix)}
      </p>
    </div>
    """
  end

  # — public: template-called helpers transpile client-side —

  @doc "Theme clamp: dark | light | auto, invalid -> dark (Lit preset default)."
  def theme("light"), do: "light"
  def theme("auto"), do: "auto"
  def theme(_), do: "dark"

  @doc "Palette clamp: default | mono | accent, invalid -> default."
  def palette("mono"), do: "mono"
  def palette("accent"), do: "accent"
  def palette(_), do: "default"

  @doc "Align clamp: start | center | end, invalid -> center."
  def align("start"), do: "start"
  def align("end"), do: "end"
  def align(_), do: "center"

  @doc "Leading piece with its spacing; empty prefix renders nothing (Lit suppression rule)."
  def line_prefix(""), do: ""
  def line_prefix(prefix) when is_binary(prefix), do: prefix <> " "
  def line_prefix(_), do: ""

  @doc "Trailing piece with its spacing; empty suffix renders nothing (Lit suppression rule)."
  def line_suffix(""), do: ""
  def line_suffix(suffix) when is_binary(suffix), do: " " <> suffix
  def line_suffix(_), do: ""

  @doc "Anchor target — empty string drops the attribute (Lit omits it)."
  def target_attr(""), do: nil
  def target_attr(target) when is_binary(target), do: target
  def target_attr(_), do: nil

  @doc "rel only guards _blank, per the Lit template."
  def rel_attr("_blank"), do: "noopener noreferrer"
  def rel_attr(_), do: nil
end
