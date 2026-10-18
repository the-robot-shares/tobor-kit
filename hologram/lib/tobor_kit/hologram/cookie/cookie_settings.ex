defmodule ToborKit.Hologram.Cookie.CookieSettings do
  @moduledoc """
  Mirror of `<noizu-cookie-settings>` (contract class A — stateless
  render-only). Button that forwards `:cookie_settings_open` (the Lit
  `cookie-settings-open` CustomEvent) to the `:target`; pair it with a
  `<CookieConsent>` embed whose `settings_open` prop the host toggles.

  Divergence (documented, PORTING.md §4.3): the Lit default-slot fallback
  ("Cookie Settings") is a `label` prop instead — slot fallback semantics
  are unverified.

  Backend: None.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  prop :label, :string, default: "Cookie Settings"
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-cookie-settings", @class)}>
      <button
        type="button"
        class="btn btn-outline btn-sm tk-cookie-settings__button"
        data-cy="cookie.settings"
        $click={action: :cookie_settings_open, target: @target}
      >
        {@label}
      </button>
    </div>
    """
  end
end
