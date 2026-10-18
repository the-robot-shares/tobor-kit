defmodule ToborKit.Hologram.P2GalleryRenderTest do
  use ExUnit.Case, async: false

  @moduletag :render

  # Conn-based render smoke tests for the phase-2 group-A gallery sections.
  # SSR strips $-bindings (PORTING.md §6.5) — assert DOM structure, classes
  # and data-cy hooks only. Command paths are covered in the family tests.

  test "GET /gallery renders the telemetry toggle section" do
    html = render_gallery()

    # consent prop path renders the checkbox; data-testid carried from the
    # Lit source (registry has no cy entries for this tag)
    assert html =~ ~s(class="tk tk-telemetry-toggle")
    assert html =~ ~s(data-testid="telemetry-toggle")
    assert html =~ "Log conversation content for debugging"
  end

  test "GET /gallery renders the model-config section" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-model-config")
    assert html =~ ~s(data-cy="model.picker")
    assert html =~ ">Inherit</option>"
    assert html =~ ~s(value="openai:gpt-5")
    assert html =~ ">GPT-5</option>"
    # value is a catalog entry → the custom fieldset stays hidden
    refute html =~ ~s(data-cy="model.custom")
    assert html =~ ~s(data-cy="model.budget")
    assert html =~ "Join"
  end

  test "GET /gallery renders the configurator section" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-configurator")
    assert html =~ ~s(data-cy="configurator.form")
    assert html =~ ~s(data-cy="configurator.field")
    assert html =~ ~s(data-field="name")
    assert html =~ ~s(data-cy="configurator.apply")
    assert html =~ ~s(data-cy="configurator.preview")
    assert html =~ ~s(data-cy="configurator.snippet")
    # seeded boolean default renders as a bare presence attribute in the snippet
    assert html =~ "enabled"
    assert html =~ "Apply"
  end

  test "GET /gallery renders the waitlist fallback email form" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-waitlist")
    assert html =~ ~s(data-cy="waitlist.form")
    assert html =~ ~s(data-cy="waitlist.email")
    assert html =~ ~s(data-cy="waitlist.submit")
    assert html =~ "Join"
    assert html =~ ~s(name="company_website")
  end

  test "GET /gallery renders the subscription-gate section" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-subscription-gate")
    # entitled embed renders slot content; blocked embed renders the panel
    assert html =~ "Entitled content (default slot)"
    assert html =~ ~s(data-cy="gate.blocked")
    assert html =~ "This content requires a subscription."
    assert html =~ ~s(data-cy="gate.link")
    assert html =~ ~s(href="/pricing")
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
