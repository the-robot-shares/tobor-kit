defmodule ToborKit.Hologram.Sg.Card do
  @moduledoc """
  Mirror of `<noizu-sg-card>` (contract class A — stateless render-only).

  `href` makes the surface a link; **host owns navigation** — the mirror
  dispatches the `sg-card-select` CustomEvent as a `:sg_card_select` action
  (`params: %{href: ...}`) to the `:target` and never navigates itself.

  Slots (documented divergence, PORTING.md §4.3 — named slots unverified):
  the body renders via the default `<slot />`; `header`/`footer` come from
  the `header`/`footer` string props instead of named slots.

  Backend: None. Host owns navigation.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  prop :href, :string, default: ""
  prop :header, :string, default: ""
  prop :footer, :string, default: ""
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-sg-card", @class)}>
      {%if has_href(@href)}
        <a
          class="tk-sg-card__card"
          data-cy="sg.card"
          href={@href}
          $click={action: :sg_card_select, params: %{href: @href}, target: @target}
        >
          <div class="tk-sg-card__header">{@header}</div>
          <div class="tk-sg-card__body"><slot /></div>
          <div class="tk-sg-card__footer">{@footer}</div>
        </a>
      {%else}
        <article
          class="tk-sg-card__card"
          data-cy="sg.card"
          $click={action: :sg_card_select, params: %{href: ""}, target: @target}
        >
          <div class="tk-sg-card__header">{@header}</div>
          <div class="tk-sg-card__body"><slot /></div>
          <div class="tk-sg-card__footer">{@footer}</div>
        </article>
      {/if}
    </div>
    """
  end

  @doc "Href trim guard — whitespace-only href renders the plain card (Lit `href.trim()`)."
  def has_href(href), do: is_binary(href) and String.trim(href) != ""
end
