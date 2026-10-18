defmodule ToborKit.Hologram.PlanCompareTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.PlanCompare.Compare

  @moduletag :render

  @template "https://checkout.example.com/c/{planId}?src=t"

  @raw_plans [
    %{"id" => "free", "name" => "Free", "priceMonthly" => 0, "priceYearly" => 0,
     "features" => ["1 agent", "Community support"]},
    %{"id" => "pro", "name" => "Pro", "priceMonthly" => 20, "priceYearly" => 200,
     "features" => ["10 agents", "Priority support", 42], "ctaLabel" => "Go Pro",
     "highlighted" => true}
  ]

  describe "normalize_plan/2" do
    test "string-keyed rows normalize with prices, features and checkout url" do
      [free, pro] = Compare.normalize_plans(@raw_plans, @template)

      assert free.id == "free"
      assert free.cta_label == ""
      assert free.highlighted == false
      assert free.features == ["1 agent", "Community support"]
      assert free.monthly_amount == "0"
      assert free.checkout_url == "https://checkout.example.com/c/free?src=t"

      assert pro.highlighted == true
      assert pro.cta_label == "Go Pro"
      # non-string features are dropped
      assert pro.features == ["10 agents", "Priority support"]
      assert pro.monthly_amount == "20"
      assert pro.checkout_url == "https://checkout.example.com/c/pro?src=t"
    end

    test "rows without id or name are dropped" do
      assert Compare.normalize_plans([%{"name" => "ghost"}, "junk"], @template) == []
    end
  end

  describe "template helpers" do
    test "cta_label/1 falls back to Choose plan" do
      assert Compare.cta_label(%{cta_label: ""}) == "Choose plan"
      assert Compare.cta_label(%{cta_label: "Go Pro"}) == "Go Pro"
    end

    test "price_amount_of/1 spells amounts" do
      assert Compare.price_amount_of(0) == "0"
      assert Compare.price_amount_of(20) == "20"
      assert Compare.price_amount_of(4.5) == "4.50"
      assert Compare.price_amount_of("9.99") == "9.99"
      assert Compare.price_amount_of(nil) == "0"
    end

    test "interval_attr/1 spells the data-interval value" do
      assert Compare.interval_attr(:monthly) == "monthly"
      assert Compare.interval_attr(:yearly) == "yearly"
    end

    test "table_rows/1 builds the feature matrix in first-seen order" do
      plans = Compare.normalize_plans(@raw_plans, @template)
      rows = Compare.table_rows(plans)

      assert [%{feature: "1 agent"}, %{feature: "Community support"},
              %{feature: "10 agents"}, %{feature: "Priority support"}] = rows
      assert [free_row, pro_row] = Enum.at(rows, 0).cells
      assert free_row == %{plan_id: "free", has: true}
      assert pro_row == %{plan_id: "pro", has: false}
    end
  end

  test "GET /gallery renders the plan-compare mirrors" do
    html = render_gallery()

    # cards layout: highlighted pro card with badge, prices and CTA links
    assert html =~ ~s(class="tk tk-plan-compare")
    assert html =~ ~s(data-cy="plan.cta")
    assert html =~ "Popular"
    assert html =~ "$0/mo"
    assert html =~ ~s(href="https://checkout.example.com/c/free?src=gallery")
    assert html =~ ~s(data-amount="20")

    # table layout: feature matrix rows
    assert html =~ ~s(data-layout="table")
    assert html =~ "Priority support"
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
