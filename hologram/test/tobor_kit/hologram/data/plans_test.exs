defmodule ToborKit.Hologram.Data.PlansTest do
  use ExUnit.Case, async: true

  alias ToborKit.Hologram.Data.Plans

  @plan %Plans{
    id: "plan_pro",
    name: "Pro",
    price_monthly: 12,
    price_yearly: 115,
    features: ["Unlimited islands", "Priority support"],
    cta_label: "Go Pro",
    highlighted: true
  }

  describe "interpolate_checkout_url/2" do
    test "mid-string token" do
      template = "https://buy.example.com/checkout/{planId}?src=kit"
      assert Plans.interpolate_checkout_url(template, "plan_pro") ==
               "https://buy.example.com/checkout/plan_pro?src=kit"
    end

    test "token at both ends" do
      assert Plans.interpolate_checkout_url("{planId}", "x") == "x"
    end

    test "absent token returns template unchanged" do
      template = "https://buy.example.com/checkout"
      assert Plans.interpolate_checkout_url(template, "plan_pro") == template
    end

    test "multiple occurrences all replaced" do
      template = "{planId}/confirm?plan={planId}"
      assert Plans.interpolate_checkout_url(template, "p9") == "p9/confirm?plan=p9"
    end

    test "non-binary input yields empty string" do
      assert Plans.interpolate_checkout_url(nil, "p") == ""
    end
  end

  describe "price_of/2" do
    test "monthly and yearly" do
      assert Plans.price_of(@plan, :monthly) == 12
      assert Plans.price_of(@plan, :yearly) == 115
    end
  end

  describe "format_price/2" do
    test "integer dollars get /mo" do
      assert Plans.format_price(12, :monthly) == "$12/mo"
    end

    test "float dollars get two decimals" do
      assert Plans.format_price(11.5, :yearly) == "$11.50/yr"
    end

    test "display strings get suffix unless already suffixed" do
      assert Plans.format_price("Free", :monthly) == "Free/mo"
      assert Plans.format_price("9 CHF/mo", :monthly) == "9 CHF/mo"
      assert Plans.format_price("99 CHF/yr", :yearly) == "99 CHF/yr"
    end
  end
end
