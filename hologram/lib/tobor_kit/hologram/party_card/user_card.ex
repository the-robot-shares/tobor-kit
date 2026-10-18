defmodule ToborKit.Hologram.PartyCard.UserCard do
  @moduledoc """
  Mirror of `<tobor-user-card>` (registry: `party-card` family) — party card
  with role/org badges and a Profile CTA. Contract class A (stateless; the
  CTA is a host-forwarding binding, PORTING.md §1).

  Lit event `user-profile` `{userId}` → CTA binding
  `$click={action: :user_profile, params: %{user_id: @user_id}, target: @target}`
  (PORTING.md §2). `:target` defaults to `"parent"`; the host owns the
  profile view.

  Inherited party surface (avatar/badges/actions slots) follows
  `ToborKit.Hologram.PartyCard.Card`'s prop-fallback divergence — this module
  repeats the card grid markup with its own `user.*` data-cy hooks, calling
  `Card`'s shared identity helpers (the flattened Lit subclass).
  """

  use Hologram.Component

  alias ToborKit.Hologram.PartyCard.Card
  alias ToborKit.Hologram.Support.Classes

  prop :display_name, :string, default: ""
  prop :handle, :string, default: ""
  prop :presence, :string, default: "offline"
  prop :user_id, :string, default: ""
  prop :role, :string, default: ""
  prop :org, :string, default: ""
  prop :avatar_src, :string, default: ""
  prop :badges, :list, default: []
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-party-card tk-user-card", @class)}>
      <article
        class="tk-party-card__card"
        data-cy="user.card"
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
          {%if role_badge(@role) != nil}
            <span class="tk-party-card__badge">{role_badge(@role)}</span>
          {/if}
          {%if org_badge(@org) != nil}
            <span class="tk-party-card__badge">{org_badge(@org)}</span>
          {/if}
          {%for badge <- @badges}
            <span class="tk-party-card__badge">{badge}</span>
          {/for}
        </div>
        <div class="tk-party-card__actions">
          <slot />
          <button
            type="button"
            class="tk-party-card__cta"
            data-cy="user.profile"
            disabled={@user_id == ""}
            $click={action: :user_profile, params: %{user_id: @user_id}, target: @target}
          >
            Profile
          </button>
        </div>
        <div class="tk-party-card__below"></div>
      </article>
    </div>
    """
  end

  # -- public helpers (templates call public fns only) ----------------------

  @doc "Lit `renderExtraBadges` role badge: trimmed, or `nil` when blank."
  def role_badge(role) do
    badge_or_nil(role)
  end

  @doc "Lit `renderExtraBadges` org badge: trimmed, or `nil` when blank."
  def org_badge(org) do
    badge_or_nil(org)
  end

  def badge_or_nil(value) do
    trimmed = String.trim(value)

    if trimmed == "" do
      nil
    else
      trimmed
    end
  end
end
