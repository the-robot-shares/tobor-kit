defmodule ToborKit.Hologram.Cookie.CookieConsent do
  @moduledoc """
  Mirror of `<noizu-cookie-consent>` (contract class B — stateful
  interactive). Renders the banner + category checkboxes; **the host owns
  persistence** (PORTING.md §4.2): there is no `localStorage` here and no
  window-event listening. The host passes the current decision in, and the
  mirror forwards every change to the `:target` as a `:cookie_consent_change`
  action (the Lit `cookie-consent-change` CustomEvent, name kept verbatim as
  an atom) carrying the full consent map:

      %{version: 1, categories: %{necessary: true, analytics: ..., marketing: ..., preferences: ...}}

  Timestamps (`acceptedAt`/`updatedAt`) are host-owned — the host stamps
  them when it persists. The Lit `start-app:cookie-consent-change` alias
  has no mirror equivalent (aliases were for same-page Lit islands).

  The Lit banner re-opens when it hears `cookie-settings-open`; the mirror
  instead exposes a `settings_open` prop the host toggles (documented
  divergence — mirrors cannot listen to window events).

  **Host requirement (class B): embed with a `cid` or init/3 never runs.**

  Backend: None. Host owns consent persistence (Phoenix session / API).
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  @version 1

  @category_details [
    %{id: :necessary, label: "Necessary", required: true},
    %{id: :analytics, label: "Analytics", required: false},
    %{id: :marketing, label: "Marketing", required: false},
    %{id: :preferences, label: "Preferences", required: false}
  ]

  prop :consent, :map, default: %{}
  prop :mode, :string, default: "categories"
  prop :settings_open, :boolean, default: false
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-cookie-consent", @class)}>
      {%if show_banner?(@decision, @settings_open)}
        <section class="card tk-cookie-consent__banner" role="dialog" aria-modal="false" data-cy="cookie.banner">
          <p>Cookie choices</p>
          <p>
            We use necessary storage to keep this app working. Optional categories are
            disabled until you approve them, and you can change your choice later.
          </p>
          {%if categories_mode?(@mode)}
            {%for category <- @category_details}
              <label class="hui checkbox-wrap tk-cookie-consent__category">
                <input
                  type="checkbox"
                  data-cy="cookie.category"
                  aria-label="{Map.get(category, :label)} cookies"
                  checked={Map.get(@draft, Map.get(category, :id))}
                  disabled={Map.get(category, :required)}
                  $change={action: :toggle_category, params: %{category: Map.get(category, :id)}}
                />
                {Map.get(category, :label)}
              </label>
            {/for}
          {/if}
          <div class="tk-cookie-consent__actions">
            {%if @settings_open and @decision != nil}
              <button type="button" class="btn btn-outline tk-cookie-consent__cancel" $click={action: :cancel_settings}>
                Cancel
              </button>
            {/if}
            <button type="button" class="btn tk-cookie-consent__accept" data-cy="cookie.accept-all" $click={action: :accept_all}>
              Accept all
            </button>
            <button type="button" class="btn btn-outline tk-cookie-consent__reject" data-cy="cookie.reject-optional" $click={action: :reject_optional}>
              {%if categories_mode?(@mode)}
                Reject optional
              {%else}
                Necessary only
              {/if}
            </button>
            {%if categories_mode?(@mode)}
              <button type="button" class="btn btn-outline tk-cookie-consent__save" data-cy="cookie.save" $click={action: :save}>
                Save
              </button>
            {/if}
          </div>
        </section>
      {/if}
    </div>
    """
  end

  def init(props, component, _server) do
    decision = normalize_decision(props.consent)

    put_state(component,
      decision: decision,
      draft: draft_from(decision),
      settings_open: props.settings_open || false,
      mode: props.mode || "categories",
      target: props.target || "parent",
      # module attribute → compile-time constant (template iterates it)
      category_details: category_details()
    )
  end

  # — actions (regex-free: map + boolean ops only) —

  def action(:accept_all, _params, component) do
    commit(component, %{necessary: true, analytics: true, marketing: true, preferences: true})
  end

  def action(:reject_optional, _params, component) do
    commit(component, %{necessary: true, analytics: false, marketing: false, preferences: false})
  end

  def action(:save, _params, component) do
    commit(component, component.state.draft)
  end

  def action(:cancel_settings, _params, component) do
    component
    |> put_state(settings_open: false, draft: draft_from(component.state.decision))
  end

  # Checkbox $change delivers params.event.value as a boolean (checked).
  # `necessary` is always forced true (Lit `onDraftChange` guard).
  def action(:toggle_category, params, component) do
    id = params.category
    checked? = truthy(params.event.value)

    if id == :necessary do
      component
    else
      draft = Map.put(component.state.draft, id, checked? == true)
      draft = Map.put(draft, :necessary, true)
      put_state(component, draft: draft)
    end
  end

  def action(_, _params, component), do: component

  # — public: template-called helpers transpile client-side —

  @doc "Category metadata (port of the Lit `consentCategoryDetails`, minus copy)."
  def category_details, do: @category_details

  @doc "Banner shows when no decision has been made or the settings panel is open."
  def show_banner?(decision, settings_open), do: decision == nil or truthy(settings_open)

  @doc "`categories` mode renders the category checkboxes (Lit `categoriesMode`)."
  def categories_mode?(mode), do: mode != "essential-all"

  # JS Boolean() semantics (Lit `Boolean(...)` normalization): only nil,
  # false, 0 and "" are falsy — strings like "yes" are truthy.
  def truthy(nil), do: false
  def truthy(false), do: false
  def truthy(0), do: false
  def truthy(""), do: false
  def truthy(_), do: true

  # — internals —

  @doc false
  def commit(component, categories) do
    consent_map = %{version: @version, categories: categories}

    component
    |> put_state(
      decision: consent_map,
      draft: categories,
      settings_open: false
    )
    |> put_action(
      name: :cookie_consent_change,
      params: consent_map,
      target: component.state.target
    )
  end

  # Host passes its stored consent (string- or atom-keyed, Lit shape) or an
  # empty map when no decision exists yet. `version` mismatch → treated as
  # no decision (Lit `getConsentState` guard).
  @doc false
  def normalize_decision(consent) when is_map(consent) and map_size(consent) > 0 do
    version = Map.get(consent, "version") || Map.get(consent, :version)

    categories = Map.get(consent, "categories") || Map.get(consent, :categories)

    if version == @version and is_map(categories) do
      %{version: @version, categories: normalize_categories(categories)}
    else
      nil
    end
  end

  @doc false
  def normalize_decision(_), do: nil

  @doc false
  def normalize_categories(categories) do
    %{
      necessary: true,
      analytics: truthy(fetch(categories, "analytics", :analytics)),
      marketing: truthy(fetch(categories, "marketing", :marketing)),
      preferences: truthy(fetch(categories, "preferences", :preferences))
    }
  end

  @doc false
  def draft_from(decision) when is_map(decision) do
    normalize_categories(Map.get(decision, :categories) || %{})
  end

  @doc false
  def draft_from(_), do: normalize_categories(%{})

  @doc false
  def fetch(map, string_key, atom_key) do
    case Map.get(map, string_key) do
      nil -> Map.get(map, atom_key)
      value -> value
    end
  end
end
