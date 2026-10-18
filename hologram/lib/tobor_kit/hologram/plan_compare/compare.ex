defmodule ToborKit.Hologram.PlanCompare.Compare do
  @moduledoc """
  Mirror of `<noizu-plan-compare>` (registry: `plan-compare` family) —
  data-driven plan comparison in `cards` or `table` layout, optional
  billing toggle. Contract class B (billing-interval state + clamping in
  init/3).

  Lit event `plan-select` `{planId, checkoutUrl, interval}` → host action
  `:plan_select` `params: %{plan_id: ..., checkout_url: ..., interval: ...}`
  dispatched with `target: @target`.

  Host-owned navigation divergence (documented): the Lit CTA is a `<button>`
  that only emits; in the mirror the CTA is an `<a href>` whose
  `checkout_url` is interpolated server-side in init/3 via
  `ToborKit.Hologram.Data.Plans.interpolate_checkout_url/2` — the host owns
  Stripe Payment Links and navigation. The click still emits `:plan_select`
  (and the browser's native navigation proceeds; Hologram does not
  `preventDefault` clicks).

  Derived state (price display for both intervals, checkout URLs, the table
  feature matrix) is computed once in init/3 so client re-renders touch only
  state. No in-kit checkout, no Stripe keys. **Backend: none. Host owns
  Stripe Payment Links, checkout and navigation.**
  """

  use Hologram.Component

  alias ToborKit.Hologram.Data.Plans
  alias ToborKit.Hologram.Data.Tools

  prop :plans, :list, default: []
  prop :layout, :string, default: "cards"
  prop :billing_toggle, :boolean, default: false
  prop :checkout_url_template, :string, default: ""
  prop :target, :string, default: "parent"

  def template do
    ~HOLO"""
    <div class="tk tk-plan-compare">
      <div class="tk-plan-compare__compare" data-cy="plan.compare" data-layout={@layout}>
        {%if @billing_toggle}
          <button
            type="button"
            class="tk-plan-compare__toggle"
            data-cy="plan.toggle"
            role="switch"
            aria-checked={flag(@interval == :yearly)}
            aria-label="Bill yearly"
            $click={:toggle_interval}
          >
            {%if @interval == :yearly}Yearly{%else}Monthly{/if}
          </button>
        {/if}
        {%if @layout == "table"}
          <table class="tk-plan-compare__table">
            <caption>Plan comparison</caption>
            <thead>
              <tr>
                <th scope="col"></th>
                {%for plan <- @plans}
                  <th
                    scope="col"
                    data-cy="plan.card"
                    data-plan-id={plan.id}
                    data-highlighted={plan.highlighted}
                  >
                    <div class="tk-plan-compare__name">{plan.name}</div>
                    <div
                      class="tk-plan-compare__price"
                      data-interval={interval_attr(@interval)}
                      data-amount={price_amount(plan, @interval)}
                    >
                      {price_display(plan, @interval)}
                    </div>
                  </th>
                {/for}
              </tr>
            </thead>
            <tbody>
              {%for row <- @table_rows}
                <tr>
                  <th scope="row">{row.feature}</th>
                  {%for cell <- row.cells}
                    <td>{%if cell.has}Yes{%else}—{/if}</td>
                  {/for}
                </tr>
              {/for}              <tr>
                <th scope="row"></th>
                {%for plan <- @plans}
                  <td>
                    <a
                      class="tk-plan-compare__cta"
                      data-cy="plan.cta"
                      data-plan-id={plan.id}
                      data-highlighted={plan.highlighted}
                      href={plan.checkout_url}
                      $click={action: :select_plan, params: %{plan_id: plan.id}}
                    >
                      {cta_label(plan)}
                    </a>
                  </td>
                {/for}
              </tr>
            </tbody>
          </table>
        {%else}
          <div class="tk-plan-compare__cards">
            {%for plan <- @plans}
              <article
                class="tk-plan-compare__card"
                data-cy="plan.card"
                data-plan-id={plan.id}
                data-highlighted={plan.highlighted}
              >
                {%if plan.highlighted}
                  <span class="tk-plan-compare__badge">Popular</span>
                {/if}
                <h2 class="tk-plan-compare__name">{plan.name}</h2>
                <div
                  class="tk-plan-compare__price"
                  data-interval={interval_attr(@interval)}
                  data-amount={price_amount(plan, @interval)}
                >
                  {price_display(plan, @interval)}
                </div>
                <ul class="tk-plan-compare__features">
                  {%for feature <- plan.features}
                    <li>{feature}</li>
                  {/for}
                </ul>
                <a
                  class="tk-plan-compare__cta"
                  data-cy="plan.cta"
                  data-plan-id={plan.id}
                  data-highlighted={plan.highlighted}
                  href={plan.checkout_url}
                  $click={action: :select_plan, params: %{plan_id: plan.id}}
                >
                  {cta_label(plan)}
                </a>
              </article>
            {/for}
          </div>
        {/if}
      </div>
    </div>
    """
  end

  def init(props, component, _server) do
    layout = if props.layout == "table", do: "table", else: "cards"
    plans = normalize_plans(props.plans, props.checkout_url_template)

    put_state(component,
      layout: layout,
      billing_toggle: props.billing_toggle == true,
      target: props.target,
      interval: :monthly,
      plans: plans,
      table_rows: table_rows(plans)
    )
  end

  # -- actions (client; transpiler-verified ops only — PORTING.md §6.1) --

  def action(:toggle_interval, _params, component) do
    interval = if component.state.interval == :yearly, do: :monthly, else: :yearly
    put_state(component, :interval, interval)
  end

  # Lit `onSelect` — the host decides what to do with the checkout URL.
  def action(:select_plan, %{plan_id: plan_id}, component) do
    plan = find_plan(component.state.plans, plan_id)
    checkout_url = (plan && plan.checkout_url) || ""

    interval =
      if component.state.billing_toggle, do: component.state.interval, else: :monthly

    put_action(component,
      name: :plan_select,
      target: component.state.target,
      params: %{plan_id: plan_id, checkout_url: checkout_url, interval: interval}
    )
  end

  # -- init-only normalization (server-side) --

  @doc "Normalizes plan rows (accepts atom- or string-keyed maps / Data.Plans structs)."
  @spec normalize_plans(any, String.t()) :: [map]
  def normalize_plans(plans, checkout_template) when is_list(plans) do
    for plan <- plans, normalized = normalize_plan(plan, checkout_template), do: normalized
  end

  def normalize_plans(_, _), do: []

  @doc "Normalizes one plan row; non-map rows are dropped (Lit `normalizePlan`)."
  @spec normalize_plan(any, String.t()) :: map | nil
  def normalize_plan(%Plans{} = plan, checkout_template) do
    normalize_plan(
      %{
        "id" => plan.id,
        "name" => plan.name,
        "priceMonthly" => plan.price_monthly,
        "priceYearly" => plan.price_yearly,
        "features" => plan.features,
        "ctaLabel" => plan.cta_label,
        "highlighted" => plan.highlighted
      },
      checkout_template
    )
  end

  def normalize_plan(plan, checkout_template) when is_map(plan) do
    id = Tools.to_s(Tools.fetch(plan, :id))

    if id != "" and Tools.to_s(Tools.fetch(plan, :name)) != "" do
      %{
        id: id,
        name: Tools.to_s(Tools.fetch(plan, :name)),
        features: plan_features(plan),
        cta_label: Tools.to_s(Tools.fetch(plan, :ctaLabel) || Tools.fetch(plan, :cta_label) || ""),
        highlighted: Tools.fetch(plan, :highlighted) == true,
        monthly_display: Plans.format_price(price_of(plan, :monthly), :monthly),
        yearly_display: Plans.format_price(price_of(plan, :yearly), :yearly),
        monthly_amount: price_amount_of(price_of(plan, :monthly)),
        yearly_amount: price_amount_of(price_of(plan, :yearly)),
        checkout_url: Plans.interpolate_checkout_url(checkout_template, id)
      }
    else
      nil
    end
  end

  def normalize_plan(_, _), do: nil

  @doc "Feature strings of a plan row (non-strings dropped, Lit `normalizePlan`)."
  @spec plan_features(map) :: [String.t()]
  def plan_features(plan) do
    case Tools.fetch(plan, :features) do
      features when is_list(features) ->
        for f <- features, is_binary(f), do: f

      _ ->
        []
    end
  end

  @doc "Price for an interval from a raw (unnormalized) plan row."
  @spec price_of(map, :monthly | :yearly) :: number | String.t()
  def price_of(plan, interval) do
    case interval do
      :yearly -> Tools.fetch(plan, :priceYearly) || Tools.fetch(plan, :price_yearly) || 0
      _ -> Tools.fetch(plan, :priceMonthly) || Tools.fetch(plan, :price_monthly) || 0
    end
  end

  # -- template helpers (public: client codegen calls publics by name) --

  @doc "CTA label (Lit `plan.ctaLabel || 'Choose plan'`)."
  @spec cta_label(map) :: String.t()
  def cta_label(plan) do
    if plan.cta_label == "", do: "Choose plan", else: plan.cta_label
  end

  @doc "Price text for the component's current interval (precomputed in init/3)."
  @spec price_display(map, :monthly | :yearly) :: String.t()
  def price_display(plan, interval) do
    if interval == :yearly, do: plan.yearly_display, else: plan.monthly_display
  end

  @doc "Raw amount for the `data-amount` attr (Lit `data-amount={String(amount)}`)."
  @spec price_amount(map, :monthly | :yearly) :: String.t()
  def price_amount(plan, interval) do
    if interval == :yearly, do: plan.yearly_amount, else: plan.monthly_amount
  end

  @doc "Lit `data-interval` is the string spelling."
  @spec interval_attr(:monthly | :yearly) :: String.t()
  def interval_attr(:yearly), do: "yearly"
  def interval_attr(_), do: "monthly"

  @doc "Amount for the data-amount attr (init-time, number/string → string)."
  @spec price_amount_of(number | String.t()) :: String.t()
  def price_amount_of(value) when is_binary(value), do: value
  def price_amount_of(value) when is_integer(value), do: Integer.to_string(value)

  def price_amount_of(value) when is_float(value) do
    :erlang.float_to_binary(value * 1.0, decimals: 2)
  end

  def price_amount_of(_), do: "0"

  @doc "Boolean attr to verbatim string."
  @spec flag(boolean) :: String.t()
  def flag(true), do: "true"
  def flag(_), do: "false"

  @doc "Plan lookup by id (client-safe comprehension — used from action/3)."
  @spec find_plan([map], String.t()) :: map | nil
  def find_plan(plans, plan_id) do
    case for p <- plans, p.id == plan_id, do: p do
      [plan | _] -> plan
      [] -> nil
    end
  end

  @doc """
  Table feature matrix: one row per unique feature (first-seen order), cells
  aligned to the plans (init/3-only; keeps `in`/`Enum.member?` out of the
  template).
  """
  @spec table_rows([map]) :: [%{feature: String.t(), cells: [%{plan_id: String.t(), has: boolean}]}]
  def table_rows(plans) do
    features =
      plans
      |> Enum.flat_map(fn plan -> plan.features end)
      |> Enum.uniq()

    for feature <- features do
      cells =
        for plan <- plans do
          %{plan_id: plan.id, has: Enum.member?(plan.features, feature)}
        end

      %{feature: feature, cells: cells}
    end
  end
end
