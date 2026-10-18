defmodule ToborKit.Hologram.Data.Plans do
  @moduledoc """
  Plan row shape + checkout-url interpolation for the plan-compare family
  (port of `web/src/components/plan-compare/plans.ts`).

  Host-owned Stripe Payment Links stay off the plan type, exactly as in Lit:
  a plan carries a pricing snapshot; the checkout URL template is a host attr
  (`checkout-url-template`) and the mirror never calls Stripe.
  """

  @typedoc "Billing interval (matches the Lit `BillingInterval` union)."
  @type interval :: :monthly | :yearly

  @typedoc """
  Plan row the island renders.

  Lit `priceMonthly`/`priceYearly` are `number | string`; `number` is dollars
  (formatted client-side in Lit, host-side here), `string` passes through
  verbatim (custom display like `"Free"`).
  """
  @type t :: %__MODULE__{
          id: String.t(),
          name: String.t(),
          price_monthly: number | String.t(),
          price_yearly: number | String.t(),
          features: [String.t()],
          cta_label: String.t() | nil,
          highlighted: boolean
        }

  defstruct id: "",
            name: "",
            price_monthly: 0,
            price_yearly: 0,
            features: [],
            cta_label: nil,
            highlighted: false

  @doc """
  Replaces every `{planId}` occurrence in the host's checkout-url template
  with the plan id (Lit `interpolateCheckoutUrl` — split/join, not regex).
  """
  @spec interpolate_checkout_url(String.t(), String.t()) :: String.t()
  def interpolate_checkout_url(template, plan_id) when is_binary(template) and is_binary(plan_id) do
    template
    |> String.split("{planId}")
    |> Enum.join(plan_id)
  end

  def interpolate_checkout_url(_template, _plan_id), do: ""

  @doc "Price for the interval (Lit `priceOf`)."
  @spec price_of(t(), interval()) :: number | String.t()
  def price_of(%__MODULE__{} = plan, :yearly), do: plan.price_yearly
  def price_of(%__MODULE__{} = plan, :monthly), do: plan.price_monthly

  @doc """
  Formats a price with a `/mo` or `/yr` suffix (Lit `formatPrice`).
  Strings that already carry a per-period suffix pass through unchanged.
  """
  @spec format_price(number | String.t(), interval()) :: String.t()
  def format_price(value, interval) when is_binary(value) do
    suffix =
      case interval do
        :yearly -> "/yr"
        :monthly -> "/mo"
      end

    if suffixed?(value), do: value, else: value <> suffix
  end

  def format_price(value, interval) when is_number(value) do
    formatted =
      if is_integer(value) do
        "$" <> Integer.to_string(value)
      else
        "$" <> :erlang.float_to_binary(value * 1.0, decimals: 2)
      end

    format_price(formatted, interval)
  end

  defp suffixed?(value) do
    endings = ["/mo", "/yr", "/month", "/year", "/Mo", "/Yr", "/Month", "/Year"]

    Enum.any?(endings, fn ending ->
      String.ends_with?(value, ending)
    end)
  end
end
