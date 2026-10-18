defmodule ToborKit.Hologram.BillingTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.Billing.Status

  # — logic —

  test "resolved_kind: complimentary flag wins over status" do
    assert Status.resolved_kind(%{"status" => "active", "complimentary" => true}) ==
             "complimentary"

    assert Status.resolved_kind(%{status: "complimentary"}) == "complimentary"
    assert Status.resolved_kind(%{"status" => "past_due"}) == "past_due"
    assert Status.resolved_kind(nil) == ""
  end

  test "status_label covers known kinds and titlecases unknowns" do
    assert Status.status_label("") == "No subscription"
    assert Status.status_label("active") == "Active"
    assert Status.status_label("past_due") == "Past due"
    assert Status.status_label("custom_thing") == "Custom thing"
  end

  test "format_billing_date collapses ISO timestamps, passes others through" do
    assert Status.format_billing_date(" 2026-01-02T03:04:05Z ") == "2026-01-02"
    assert Status.format_billing_date("2026-01-02") == "2026-01-02"
    assert Status.format_billing_date("not a date") == "not a date"
  end

  test "date_line orders trial then renews with the separator" do
    sub = %{"trial_ends_at" => "2026-01-02T03:04:05Z", "renews_at" => "2026-02-03T00:00:00Z"}
    assert Status.date_line(sub) == "Trial ends 2026-01-02 · Renews 2026-02-03"
    assert Status.date_line(%{"renews_at" => "2026-02-03"}) == "Renews 2026-02-03"
    assert Status.date_line(%{}) == ""
  end

  test "plan_name trims" do
    assert Status.plan_name(%{"plan_name" => "  Studio  "}) == "Studio"
    assert Status.plan_name(%{planName: "Pro"}) == "Pro"
    assert Status.plan_name(%{}) == ""
    assert Status.plan_name(nil) == ""
  end

  # — rendered HTML —

  @moduletag :render

  test "gallery renders the billing status mirrors with registry data-cy hooks" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-billing-status")
    assert html =~ ~s(data-cy="billing.status")
    assert html =~ ~s(data-kind="past_due")
    assert html =~ ~s(Past due)
    assert html =~ ~s(data-cy="billing.plan")
    assert html =~ ~s(Studio)
    assert html =~ ~s(Trial ends 2026-01-02 · Renews 2026-02-03)
    assert html =~ ~s(data-cy="billing.portal")
    assert html =~ ~s(Manage billing)

    # empty snapshot: "No subscription", data-kind attr dropped (Lit `|| nothing`)
    assert html =~ ~s(No subscription)

    empty_variant =
      html
      |> String.split(~s(No subscription))
      |> List.first()
      |> String.split(~s(class="tk tk-billing-status"))
      |> List.last()

    refute empty_variant =~ "data-kind"
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
