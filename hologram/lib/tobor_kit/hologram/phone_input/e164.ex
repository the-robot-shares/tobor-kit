defmodule ToborKit.Hologram.PhoneInput.E164 do
  @moduledoc """
  Host-side E.164 helpers for the phone-input family (port of the pure
  functions in `web/src/components/phone-input/dial-codes.ts`).

  **Server-side only.** These functions use regular expressions, which the
  Hologram client runtime cannot evaluate (PORTING.md §6.1) — the mirror's
  client actions stay regex-free and full validation happens here, in host
  code. In-kit E.164 is `+<dial><national-digits>` — no libphonenumber.
  """

  alias ToborKit.Hologram.Data.DialCodes

  @e164_re ~r/^\+[1-9]\d{7,14}$/

  @typedoc "Parsed phone: `%{country, national, dial}` (Lit `ParsedPhone`)."
  @type parsed :: %{country: String.t(), national: String.t(), dial: String.t()}

  @doc "Digit-only filter (Lit `digitsOnly` — `\\D+` → `\"}`)."
  @spec digits_only(String.t()) :: String.t()
  def digits_only(raw) when is_binary(raw), do: String.replace(raw, ~r/\D+/, "")
  def digits_only(_), do: ""

  @doc "ITU E.164 check: 8–15 digits after `+`, first digit 1–9 (Lit `isValidE164`)."
  @spec valid_e164?(String.t()) :: boolean
  def valid_e164?(value) when is_binary(value), do: Regex.match?(@e164_re, value)
  def valid_e164?(_), do: false

  @doc """
  Builds an E.164 value from a country code + raw national input
  (port of Lit `toE164`): handles `+`/`00` prefixes, strips leading
  trunk zeros outside NANP, and drops a repeated dial code.
  """
  @spec to_e164(String.t(), String.t()) :: String.t()
  def to_e164(country, national_raw) when is_binary(country) and is_binary(national_raw) do
    entry = DialCodes.lookup_country(country)
    trimmed = String.trim(national_raw)

    if trimmed == "" do
      ""
    else
      to_e164_from_plus(trimmed, entry) || from_national(trimmed, entry)
    end
  end

  def to_e164(_, _), do: ""

  # `+`/`00`-prefixed input parses against the table first; when the parse
  # yields no national part the Lit version falls through to digit filtering.
  defp to_e164_from_plus(trimmed, entry) do
    if String.starts_with?(trimmed, "+") or String.starts_with?(trimmed, "00") do
      as_plus =
        if String.starts_with?(trimmed, "00"),
          do: "+" <> String.slice(trimmed, 2..-1//1),
          else: trimmed

      case parse_e164(as_plus, entry.iso2) do
        %{national: national, dial: dial} when national != "" -> "+#{dial}#{national}"
        _ -> nil
      end
    else
      nil
    end
  end

  defp from_national(trimmed, entry) do
    national =
      trimmed
      |> digits_only()
      |> strip_trunk_zero(entry.dial)
      |> strip_dial_prefix(entry.dial)

    if national == "", do: "", else: "+#{entry.dial}#{national}"
  end

  @doc """
  Parses an E.164-ish string into `%{country, national, dial}`, resolving the
  country by longest dial-code prefix match (port of Lit `parseE164`).
  """
  @spec parse_e164(String.t(), String.t()) :: parsed() | nil
  def parse_e164(value, fallback_country \\ DialCodes.default_country())

  def parse_e164(value, fallback_country) when is_binary(value) and is_binary(fallback_country) do
    trimmed = String.trim(value)

    if trimmed == "" do
      nil
    else
      fallback = DialCodes.lookup_country(fallback_country)
      base = if String.starts_with?(trimmed, "00"), do: String.slice(trimmed, 2..-1//1), else: trimmed
      digits = digits_only(base)

      if digits == "" do
        nil
      else
        plus_form? = String.starts_with?(trimmed, "+") or String.starts_with?(trimmed, "00")

        if plus_form? do
          parse_international(digits, fallback)
        else
          national = strip_trunk_zero(digits, fallback.dial)
          %{country: fallback.iso2, national: national, dial: fallback.dial}
        end
      end
    end
  end

  def parse_e164(_, _), do: nil

  defp parse_international(digits, fallback) do
    best =
      DialCodes.entries()
      |> Enum.filter(&(String.starts_with?(digits, &1.dial)))
      |> Enum.sort_by(&{String.length(&1.dial), &1.iso2 == fallback.iso2})
      |> List.last()

    case best do
      nil -> %{country: fallback.iso2, national: digits, dial: fallback.dial}
      entry -> %{country: entry.iso2, national: String.slice(digits, String.length(entry.dial)..-1//1), dial: entry.dial}
    end
  end

  defp strip_trunk_zero(national, dial) do
    if String.starts_with?(national, "0") and dial != "1" do
      # strip ALL leading zeros (Lit `replace(/^0+/, '')`)
      String.replace(national, ~r/^0+/, "")
    else
      national
    end
  end

  defp strip_dial_prefix(national, dial) do
    len = String.length(dial)

    if String.starts_with?(national, dial) and String.length(national) - len >= 7 do
      String.slice(national, len..-1//1)
    else
      national
    end
  end
end
