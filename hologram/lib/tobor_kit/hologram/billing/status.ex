defmodule ToborKit.Hologram.Billing.Status do
  @moduledoc """
  Mirror of `<noizu-billing-status>` (contract class A — stateless
  render-only). Host supplies the subscription snapshot; `portal-open`
  becomes a `:portal_open` action dispatched to the `:target` — the host
  owns the Stripe customer portal. No Stripe in the mirror.

  `subscription` is a map (string- or atom-keyed; the Lit property is
  JS-only): `%{status, trial_ends_at | trialEndsAt, renews_at | renewsAt,
  complimentary, plan_name | planName}`. Hosts pass snake_case per the
  param convention; camelCase is accepted for Lit-source compatibility.

  Backend: None. Host owns the Stripe customer portal.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Support.Classes

  prop :subscription, :map, default: nil
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-billing-status", @class)}>
      <div class="tk-billing-status__row">
        <span class="tk-billing-status__status" data-cy="billing.status" data-kind={kind_attr(@subscription)}>
          {status_label(resolved_kind(@subscription))}
        </span>
        {%if plan_name(@subscription) != ""}
          <span class="tk-billing-status__plan" data-cy="billing.plan">{plan_name(@subscription)}</span>
        {/if}
        {%if date_line(@subscription) != ""}
          <span class="tk-billing-status__dates">{date_line(@subscription)}</span>
        {/if}
        <button
          type="button"
          class="tk-billing-status__portal"
          data-cy="billing.portal"
          $click={action: :portal_open, target: @target}
        >
          Manage billing
        </button>
      </div>
    </div>
    """
  end

  # — public: template-called helpers transpile client-side —

  @doc "Kind resolution: complimentary wins, then the raw status, empty when no snapshot."
  def resolved_kind(nil), do: ""

  def resolved_kind(sub) when is_map(sub) do
    complimentary = truthy(fetch(sub, "complimentary", :complimentary))

    if complimentary or fetch(sub, "status", :status) == "complimentary" do
      "complimentary"
    else
      status_string(fetch(sub, "status", :status))
    end
  end
  def resolved_kind(_), do: ""

  @doc "`data-kind` attr value — `nil` (attr dropped) when there is no snapshot (Lit `kind || nothing`)."
  def kind_attr(sub) do
    case resolved_kind(sub) do
      "" -> nil
      kind -> kind
    end
  end

  @doc "Plan name, trimmed (Lit `planName?.trim() ?? ''`)."
  def plan_name(nil), do: ""
  def plan_name(sub) do
    case fetch(sub, "plan_name", :planName) do
      name when is_binary(name) -> String.trim(name)
      _ -> ""
    end
  end

  @doc "`Trial ends … · Renews …` line from the snapshot's ISO dates."
  def date_line(nil), do: ""
  def date_line(sub) do
    trial = fetch(sub, "trial_ends_at", :trialEndsAt)
    renews = fetch(sub, "renews_at", :renewsAt)

    parts =
      []
      |> append_date_part(trial, "Trial ends ")
      |> append_date_part(renews, "Renews ")

    Enum.join(parts, " · ")
  end

  @doc """
  ISO timestamps collapse to `YYYY-MM-DD` so renders are timezone-stable.
  Divergence (documented): the Lit fallback parses arbitrary strings with
  `Date.parse`; the mirror only rewrites `YYYY-MM-DD…`-prefixed values and
  passes anything else through untouched — hosts pass ISO timestamps.
  """
  def format_billing_date(value) when is_binary(value) do
    trimmed = String.trim(value)

    case trimmed do
      <<y::binary-size(4), "-", m::binary-size(2), "-", d::binary-size(2), _rest::binary>> ->
        y <> "-" <> m <> "-" <> d

      _ ->
        trimmed
    end
  end

  def format_billing_date(_), do: ""

  @doc "Human label for a billing kind (port of the Lit `STATUS_LABEL` + titlecase fallback)."
  def status_label(""), do: "No subscription"
  def status_label("active"), do: "Active"
  def status_label("trialing"), do: "Trialing"
  def status_label("past_due"), do: "Past due"
  def status_label("canceled"), do: "Canceled"
  def status_label("complimentary"), do: "Complimentary"
  def status_label(kind), do: titlecase_spaces(kind)

  # — internals (public for client codegen) —

  def append_date_part(parts, date, prefix) when is_binary(date) and date != "" do
    parts ++ [prefix <> format_billing_date(date)]
  end

  def append_date_part(parts, _, _), do: parts

  def titlecase_spaces(kind) do
    kind
    |> String.replace("_", " ")
    |> String.trim()
    |> titlecase()
  end

  def titlecase(""), do: "No subscription"

  def titlecase(<<first::utf8, rest::binary>>) do
    <<upcase_utf8(first)::utf8>> <> rest
  end

  def titlecase(kind), do: kind

  def upcase_utf8(codepoint) do
    case <<codepoint::utf8>> do
      <<char>> when char in ?a..?z -> char - 32
      _ -> codepoint
    end
  end

  def status_string(nil), do: ""
  def status_string(status) when is_binary(status), do: status
  def status_string(status), do: to_string(status)

  def truthy(true), do: true
  def truthy(_), do: false

  def fetch(map, string_key, atom_key) do
    case Map.get(map, string_key) do
      nil -> Map.get(map, atom_key)
      value -> value
    end
  end
end
