defmodule ToborKit.Hologram.PartyCard.AgentCard do
  @moduledoc """
  Mirror of `<tobor-agent-card>` (registry: `party-card` family) — party card
  with model badge, capability chips, and a Chat CTA. Contract class A
  (stateless; the CTA is a host-forwarding binding, PORTING.md §1).

  Lit event `agent-chat` `{agentId}` → CTA binding
  `$click={action: :agent_chat, params: %{agent_id: @agent_id}, target: @target}`
  (PORTING.md §2; the default target is the containing stateful component —
  the Lit bubble-to-host analog). `:target` defaults to `"parent"`;
  the host owns the conversation.

  Lit `show-capabilities` converter (true unless the literal `"false"`) dies
  at the attribute boundary (PORTING.md §3): the mirror prop is `:boolean,
  default: true`.

  Inherited party surface (avatar/badges/actions slots) follows
  `ToborKit.Hologram.PartyCard.Card`'s prop-fallback divergence — this module
  repeats the card grid markup with its own `agent.*` data-cy hooks, calling
  `Card`'s shared identity helpers (the flattened Lit subclass).
  """

  use Hologram.Component

  alias ToborKit.Hologram.PartyCard.Card
  alias ToborKit.Hologram.Support.Classes

  prop :display_name, :string, default: ""
  prop :handle, :string, default: ""
  prop :presence, :string, default: "offline"
  prop :agent_id, :string, default: ""
  prop :model_badge, :string, default: ""
  prop :show_capabilities, :boolean, default: true
  prop :capabilities, :list, default: []
  prop :avatar_src, :string, default: ""
  prop :badges, :list, default: []
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-party-card tk-agent-card", @class)}>
      <article
        class="tk-party-card__card"
        data-cy="agent.card"
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
          {%if trim(@model_badge) != ""}
            <span class="tk-party-card__badge tk-party-card__badge--model">{trim(@model_badge)}</span>
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
            data-cy="agent.chat"
            disabled={@agent_id == ""}
            $click={action: :agent_chat, params: %{agent_id: @agent_id}, target: @target}
          >
            Chat
          </button>
        </div>
        <div class="tk-party-card__below">
          {%if @show_capabilities}
            <ul class="tk-party-card__caps" data-cy="agent.caps">
              {%for cap <- capability_chips(@capabilities)}
                <li class="tk-party-card__badge">{cap}</li>
              {/for}
            </ul>
          {/if}
        </div>
      </article>
    </div>
    """
  end

  # -- public helpers (templates call public fns only) ----------------------

  @doc "Lit `renderExtraBadges` trim: badges only render when non-blank."
  def trim(value) do
    String.trim(value)
  end

  @doc "Lit `renderBelow` capability list: trim + drop blanks."
  def capability_chips(capabilities) do
    capabilities
    |> Enum.map(&trim/1)
    |> Enum.reject(&(&1 == ""))
  end
end
