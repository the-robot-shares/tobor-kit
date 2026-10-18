defmodule ToborKit.Hologram.CookieTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.Cookie.CookieConsent

  # — logic —

  test "category details cover the four consent categories, necessary required" do
    details = CookieConsent.category_details()
    assert Enum.map(details, &Map.get(&1, :id)) == [:necessary, :analytics, :marketing, :preferences]
    assert Enum.find(details, &(&1.id == :necessary)).required
    refute Enum.find(details, &(&1.id == :analytics)).required
  end

  test "banner visibility: no decision shows, decided hides, settings_open re-opens" do
    assert CookieConsent.show_banner?(nil, false)
    refute CookieConsent.show_banner?(%{version: 1}, false)
    assert CookieConsent.show_banner?(%{version: 1}, true)
  end

  test "categories_mode? is everything but essential-all" do
    assert CookieConsent.categories_mode?("categories")
    refute CookieConsent.categories_mode?("essential-all")
  end

  test "normalize_decision accepts the Lit shape, rejects missing/wrong version" do
    decision =
      CookieConsent.normalize_decision(%{
        "version" => 1,
        "categories" => %{"analytics" => true, "marketing" => "yes"}
      })

    assert decision == %{
             version: 1,
             categories: %{necessary: true, analytics: true, marketing: true, preferences: false}
           }

    assert CookieConsent.normalize_decision(%{}) == nil
    assert CookieConsent.normalize_decision(%{"version" => 2, "categories" => %{}}) == nil
    assert CookieConsent.normalize_decision(%{"version" => 1}) == nil
  end

  test "accept_all updates state, closes settings and queues the host notification" do
    component = init_consent(settings_open: true, target: "page")
    result = CookieConsent.action(:accept_all, %{}, component)

    assert result.state.settings_open == false
    assert result.state.decision.categories == %{
             necessary: true,
             analytics: true,
             marketing: true,
             preferences: true
           }

    action = result.next_action
    assert action.name == :cookie_consent_change
    assert action.target == "page"
    assert action.params == %{
             version: 1,
             categories: %{necessary: true, analytics: true, marketing: true, preferences: true}
           }
  end

  test "reject_optional keeps only necessary" do
    component = init_consent([])
    result = CookieConsent.action(:reject_optional, %{}, component)

    assert result.state.decision.categories == %{
             necessary: true,
             analytics: false,
             marketing: false,
             preferences: false
           }
  end

  test "toggle_category updates the draft, necessary cannot be untoggled" do
    component = init_consent([])

    result =
      CookieConsent.action(:toggle_category, %{category: :analytics, event: %{value: true}}, component)

    assert result.state.draft.analytics == true

    result =
      CookieConsent.action(:toggle_category, %{category: :necessary, event: %{value: false}}, component)

    assert result.state.draft.necessary == true
  end

  test "cancel_settings closes and resets the draft from the decision" do
    consent = %{"version" => 1, "categories" => %{"analytics" => true}}
    component = init_consent(consent: consent, settings_open: true)

    result =
      CookieConsent.action(:toggle_category, %{category: :marketing, event: %{value: true}}, component)

    result = CookieConsent.action(:cancel_settings, %{}, result)

    assert result.state.settings_open == false
    assert result.state.draft.analytics == true
    assert result.state.draft.marketing == false
  end

  defp init_consent(overrides) do
    props =
      Map.merge(
        %{
          consent: %{},
          mode: "categories",
          settings_open: false,
          target: "parent",
          class: ""
        },
        Map.new(overrides)
      )

    CookieConsent.init(props, %Hologram.Component{}, %Hologram.Server{})
  end

  # — rendered HTML —

  @moduletag :render

  test "gallery renders the consent banner with registry data-cy hooks" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-cookie-consent")
    assert html =~ ~s(data-cy="cookie.banner")
    assert html =~ ~s(data-cy="cookie.category")
    assert html =~ ~s(data-cy="cookie.accept-all")
    assert html =~ ~s(data-cy="cookie.reject-optional")
    assert html =~ ~s(data-cy="cookie.save")
    assert html =~ ~s(role="dialog" aria-modal="false")

    # necessary is checked + disabled; optional categories start unchecked
    assert html =~
             ~s(aria-label="Necessary cookies" checked="true" disabled="true")

    # exactly two banners: the undecided one + the settings_open re-open
    # (the decided essential-all variant hides the banner — host-owned persistence)
    banner_count = html |> String.split(~s(data-cy="cookie.banner")) |> length() |> Kernel.-(1)
    assert banner_count == 2

    # the essential-all decided variant hides the banner (host-owned persistence);
    # the undecided + settings-reopened banners both run in categories mode
    assert html =~ "Reject optional"
  end

  test "gallery renders the cookie settings trigger" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-cookie-settings")
    assert html =~ ~s(data-cy="cookie.settings")
    assert html =~ "Cookie Settings"
  end

  defp render_gallery do
    conn =
      :get
      |> Plug.Test.conn("/gallery")
      |> Map.put(
        :secret_key_base,
        "tk_hologram_test_secret_key_base_padding_padding_padding_at_least_64_bytes_long__"
      )
      |> Plug.Conn.fetch_query_params()
      |> ToborKit.Hologram.TestSupport.Router.call([])

    assert conn.status == 200, "expected 200, got #{conn.status}"
    conn.resp_body
  end
end
