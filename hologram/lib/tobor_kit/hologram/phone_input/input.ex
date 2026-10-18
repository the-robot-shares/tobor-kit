defmodule ToborKit.Hologram.PhoneInput.Input do
  @moduledoc """
  Mirror of `<noizu-phone-input>` (contract class B — stateful interactive).

  Country selector + national number field. The client-side actions are
  regex-free per the spike contract (PORTING.md §6.1): they store the raw
  input and apply a digit-only filter (for `mobile_only` display). **E.164
  validity is computed host-side** — hosts combine the emitted country +
  national value with `ToborKit.Hologram.PhoneInput.E164.to_e164/2` /
  `valid_e164?/1`; `phone-invalid` fires from the host side.

  Event contract (Lit names verbatim → snake_case actions, forwarded to
  `:target`):

  | Lit event | Mirror action | Params |
  |---|---|---|
  | `country-change` | `:country_change` | `%{country, dial}` |
  | `phone-change` | `:phone_change` | `%{value}` (raw national digits, not E.164 — divergence) |
  | `phone-invalid` | host-side | host computes + reacts |

  **Host requirement (class B): embed with a `cid` or init/3 never runs.**

  Backend: None. Host owns uniqueness/OTP validation.
  """

  use Hologram.Component

  alias ToborKit.Hologram.Data.DialCodes
  alias ToborKit.Hologram.PhoneInput.E164
  alias ToborKit.Hologram.Support.Classes

  prop :country, :string, default: "US"
  prop :mobile_only, :boolean, default: false
  prop :name, :string, default: ""
  prop :described_by, :string, default: ""
  prop :disabled, :boolean, default: false
  prop :value, :string, default: ""
  prop :target, :string, default: "parent"
  prop :class, :string, default: ""

  def template do
    ~HOLO"""
    <div class={Classes.classes("tk tk-phone-input", @class)}>
      <div class="tk-phone-input__row" data-invalid={@invalid}>        <select
          class="tk-phone-input__country"
          data-cy="phone.country"
          aria-label="Country"
          disabled={@disabled}
          $change={action: :set_country}
        >
          {%for entry <- entries()}
            <option value={Map.get(entry, :iso2)} selected={Map.get(entry, :iso2) == @country}>
              {Map.get(entry, :flag)} {Map.get(entry, :iso2)} +{Map.get(entry, :dial)}
            </option>
          {/for}
        </select>
        <span class="tk-phone-input__dial dial" data-cy="phone.dial">+{dial(@country)}</span>
        <input
          class="tk-phone-input__input"
          data-cy="phone.input"
          type="tel"
          inputmode="tel"
          autocomplete={autocomplete(@mobile_only)}
          name={@name}
          aria-label="Phone number"
          aria-invalid={@invalid}
          aria-describedby={@described_by}
          value={@national}
          disabled={@disabled}
          $change={action: :set_national}
        />
      </div>
    </div>
    """
  end

  def init(props, component, _server) do
    # Server-side: full E.164 parse of the incoming value (regex welcome here).
    # Like Lit's applyIncomingValue, a parseable value adopts its own country.
    {country, national} = incoming(E164.parse_e164(props.value, props.country), props)

    put_state(component,
      country: country,
      national: national,
      mobile_only: props.mobile_only || false,
      disabled: props.disabled || false,
      name: props.name || "",
      described_by: props.described_by || "",
      target: props.target || "parent",
      invalid: invalid_flag(props.value)
    )
  end

  def action(:set_country, params, component) do
    if component.state.disabled do
      component
    else
      iso2 = DialCodes.lookup_country(params.event.value).iso2
      entry = DialCodes.lookup_country(iso2)

      component
      |> put_state(country: iso2)
      |> put_action(
        name: :country_change,
        params: %{country: iso2, dial: "+#{entry.dial}"},
        target: component.state.target
      )
    end
  end

  def action(:set_national, params, component) do
    if component.state.disabled do
      component
    else
      raw = params.event.value || ""

      # Regex-free per PORTING.md §6.1: digit-filter for mobile_only display.
      next =
        if component.state.mobile_only do
          filter_digits(raw)
        else
          raw
        end

      component
      |> put_state(national: next)
      |> put_action(
        name: :phone_change,
        params: %{value: filter_digits(next)},
        target: component.state.target
      )
    end
  end

  def action(_, _params, component), do: component

  # — public: template-called helpers transpile client-side —

  @doc "Dial-code entries for the country picker (Lit registry order preserved)."
  def entries, do: DialCodes.entries()

  @doc "Dial digits for the display span, via table lookup."
  def dial(country), do: DialCodes.lookup_country(country).dial

  @doc "`autocomplete` hint — `tel-national` for mobile-only fields (Lit)."
  def autocomplete(true), do: "tel-national"
  def autocomplete(_), do: "tel"

  @doc "Regex-free digit filter (spike-verified graphemes path, PORTING.md §6.1)."
  def filter_digits(raw) when is_binary(raw) do
    raw
    |> String.graphemes()
    |> Enum.filter(&digit?/1)
    |> Enum.join("")
  end

  def filter_digits(_), do: ""

  def digit?(char), do: char in ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]

  # — internals —

  # Server-side: host passes E.164 in `value`; split it into country +
  # national for display, mirroring Lit's `applyIncomingValue`.
  defp incoming(%{country: c, national: national}, _props) do
    {DialCodes.lookup_country(c).iso2, national}
  end

  defp incoming(nil, props) do
    {DialCodes.lookup_country(props.country || "US").iso2, ""}
  end

  defp invalid_flag(value) when is_binary(value) and value != "",
    do: if(E164.valid_e164?(value), do: "false", else: "true")

  defp invalid_flag(_), do: "false"
end
