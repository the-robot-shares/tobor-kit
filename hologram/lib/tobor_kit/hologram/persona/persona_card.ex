defmodule ToborKit.Hologram.Persona.PersonaCard do
  @moduledoc """
  Mirror of `<tobor-persona-card>` (registry: `persona` family) — party-card
  identity chrome for a selectable persona. Contract class A (stateless; the
  Select CTA is a host-forwarding binding, PORTING.md §1).

  Lit event `persona-select` `{personaId}` → CTA binding
  `$click={action: :persona_select, params: %{persona_id: @persona_id}, target: @target}`
  (PORTING.md §2). `:target` defaults to `"parent"`; the host owns the
  switch. Never navigates.

  Inherited party surface (avatar/badges/actions slots) follows
  `ToborKit.Hologram.PartyCard.Card`'s prop-fallback divergence — this module
  repeats the card grid markup with its own `persona.card` data-cy hook,
  calling `Card`'s shared identity helpers (the flattened Lit subclass).

  Registry note: only `persona.card` is a data-cy hook — the Lit Select
  button carries a `part` (dropped per PORTING.md §5), not a `data-cy`.
  """

  use Hologram.Component

  alias ToborKit.Hologram.PartyCard.Card
  alias ToborKit.Hologram.Support.Classes

  prop :persona_id, :string, default: ""
  prop :display_name, :string, default: ""
  prop :handle, :string, default: ""
  prop :presence, :string, default: "offline"
  prop :avatar_src, :string, default: ""
  prop :badges, :list, default: []
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-party-card tk-persona-card", @class)}>
      <article
        class="tk-party-card__card"
        data-cy="persona.card"
        data-presence={Card.resolved_presence(@presence)}
      >
        <div class="tk-party-card__avatar">
          {%if @avatar_src != ""}
            <img class="tk-party-card__avatar-img" src={@avatar_src} alt={@display_name} />
          {%else}
            <span class="tk-party-card__initials">{Card.initials(@display_name)}</span>
          {/if}
        </div>
        <div class="tk-party-card__identity">
          <div class="tk-party-card__name-row">
            <span class="tk-party-card__name" data-cy="party.name">{@display_name}</span>
            <span
              class="tk-party-card__presence"
              data-cy="party.presence"
              data-presence={Card.resolved_presence(@presence)}
              title={Card.presence_label(Card.resolved_presence(@presence))}
              aria-label={Card.presence_label(Card.resolved_presence(@presence))}
              hidden={Card.resolved_presence(@presence) == "hidden"}
            >
            </span>
          </div>
          <span class="tk-party-card__handle" data-cy="party.handle">{@handle}</span>
        </div>
        <div class="tk-party-card__badges">
          {%for badge <- @badges}
            <span class="tk-party-card__badge">{badge}</span>
          {/for}
        </div>
        <div class="tk-party-card__actions">
          <slot />
          <button
            type="button"
            class="tk-party-card__cta"
            disabled={@persona_id == ""}
            $click={action: :persona_select, params: %{persona_id: @persona_id}, target: @target}
          >
            Select
          </button>
        </div>
        <div class="tk-party-card__below"></div>
      </article>
    </div>
    """
  end
end
