defmodule ToborKit.Hologram.PartyCard.Card do
  @moduledoc """
  Mirror of `<tobor-party-card>` (registry: `web/registry.yaml` → `party-card`)
  — shared identity chrome for agent and user cards. Contract class A
  (stateless render-only; PORTING.md §1).

  Lit surface → mirror surface:

    * attrs `display-name`, `handle`, `presence` → props `:display_name`,
      `:handle`, `:presence` (invalid presence clamps to `"offline"`,
      mirroring the Lit `willUpdate` clamp).
    * named slots `avatar` / `badges` / `actions` → prop fallbacks +
      default slot (Hologram v0.10 supports the default slot only — see
      `docs/PORTING.md` §4.3):
      - `avatar` slot → `:avatar_src` prop (image URL); empty falls back to
        the computed initials span, like the Lit fallback content.
      - `badges` slot → `:badges` prop (list of strings, rendered as chips).
      - `actions` slot → default slot (host-authored children render into
        the actions area with their own host bindings).
    * `cardCy` override point of the Lit base → each subclass module writes
      its own `data-cy` on the card root; the shared identity markup helpers
      below are this module's public functions (the Lit `partyCardStyles` /
      exported-helpers equivalent).

  Emits nothing itself. Host-owned concerns (chat, profile, persona switch)
  are the subclass CTAs' host-forwarding bindings.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  prop :display_name, :string, default: ""
  prop :handle, :string, default: ""
  prop :presence, :string, default: "offline"
  prop :avatar_src, :string, default: ""
  prop :badges, :list, default: []
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-party-card", @class)}>
      <article
        class="tk-party-card__card"
        data-cy="party.card"
        data-presence={resolved_presence(@presence)}
      >
        <div class="tk-party-card__avatar">
          {%if @avatar_src != ""}
            <img class="tk-party-card__avatar-img" src={@avatar_src} alt={@display_name} />
          {%else}
            <span class="tk-party-card__initials">{initials(@display_name)}</span>
          {/if}
        </div>
        <div class="tk-party-card__identity">
          <div class="tk-party-card__name-row">
            <span class="tk-party-card__name" data-cy="party.name">{@display_name}</span>
            <span
              class="tk-party-card__presence"
              data-cy="party.presence"
              data-presence={resolved_presence(@presence)}
              title={presence_label(resolved_presence(@presence))}
              aria-label={presence_label(resolved_presence(@presence))}
              hidden={resolved_presence(@presence) == "hidden"}
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
        </div>
        <div class="tk-party-card__below"></div>
      </article>
    </div>
    """
  end

  # -- shared identity helpers (public: templates call public fns only) ----

  @presences ["online", "away", "offline", "hidden"]

  @doc "Lit `PARTY_PRESENCES` — the valid presence values, verbatim."
  def presences, do: @presences

  @doc """
  Lit `resolvedPresence` / `willUpdate` clamp: anything outside
  `presences/0` resolves to `"offline"`.
  """
  def resolved_presence(presence) when presence in @presences, do: presence
  def resolved_presence(_other), do: "offline"

  @doc "Lit `PRESENCE_LABEL` — human label for a (resolved) presence."
  def presence_label(presence) do
    Map.get(
      %{"online" => "Online", "away" => "Away", "offline" => "Offline", "hidden" => "Hidden"},
      presence,
      "Offline"
    )
  end

  @doc """
  Lit `initials` getter: first grapheme of each of the first two
  whitespace-separated parts, upcased; `"?"` when empty.

  Regex-free port (the Lit source splits on `/\\s+/`; client code bans
  regexes — PORTING.md §6): split on `" "` and drop empties.
  """
  def initials(display_name) do
    display_name
    |> String.trim()
    |> String.split(" ")
    |> Enum.reject(&(&1 == ""))
    |> initials_from()
  end

  @doc "Initials from pre-split parts (see `initials/1`)."
  def initials_from([]), do: "?"

  def initials_from([first]), do: first_upcase(first)

  def initials_from([first, second | _rest]) do
    first_upcase(first) <> first_upcase(second)
  end

  @doc "First grapheme of `part`, upcased (empty-string part yields empty string)."
  def first_upcase(part) do
    case String.at(part, 0) do
      nil -> ""
      char -> String.upcase(char)
    end
  end
end
