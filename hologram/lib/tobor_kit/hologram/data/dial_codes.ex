defmodule ToborKit.Hologram.Data.DialCodes do
  @moduledoc """
  Vendored ISO-3166 alpha-2 calling codes for the phone-input family
  (port of `web/src/components/phone-input/dial-codes.ts`).

  In-kit E.164 is `+<dial><national-digits>` — no libphonenumber. The table
  order matches the Lit source: preferred markets first, then remaining
  ISO-3166 entries A–Z; mirrors must preserve order because pickers render
  rows positionally.
  """

  @default_country "US"

  @typedoc "Country calling code digits, no leading `+`."
  @type entry :: %{
          required(:iso2) => String.t(),
          required(:dial) => String.t(),
          required(:name) => String.t(),
          required(:flag) => String.t()
        }

  @rows [
    {"US", "1", "United States"},
    {"CA", "1", "Canada"},
    {"GB", "44", "United Kingdom"},
    {"AU", "61", "Australia"},
    {"NZ", "64", "New Zealand"},
    {"DE", "49", "Germany"},
    {"FR", "33", "France"},
    {"JP", "81", "Japan"},
    {"KR", "82", "South Korea"},
    {"CN", "86", "China"},
    {"IN", "91", "India"},
    {"TH", "66", "Thailand"},
    {"SG", "65", "Singapore"},
    {"AE", "971", "United Arab Emirates"},
    {"BR", "55", "Brazil"},
    {"MX", "52", "Mexico"},
    {"AD", "376", "Andorra"},
    {"AF", "93", "Afghanistan"},
    {"AG", "1268", "Antigua and Barbuda"},
    {"AL", "355", "Albania"},
    {"AM", "374", "Armenia"},
    {"AO", "244", "Angola"},
    {"AR", "54", "Argentina"},
    {"AT", "43", "Austria"},
    {"AZ", "994", "Azerbaijan"},
    {"BA", "387", "Bosnia and Herzegovina"},
    {"BB", "1246", "Barbados"},
    {"BD", "880", "Bangladesh"},
    {"BE", "32", "Belgium"},
    {"BG", "359", "Bulgaria"},
    {"BH", "973", "Bahrain"},
    {"BN", "673", "Brunei"},
    {"BO", "591", "Bolivia"},
    {"BS", "1242", "Bahamas"},
    {"BY", "375", "Belarus"},
    {"BZ", "501", "Belize"},
    {"CH", "41", "Switzerland"},
    {"CI", "225", "Côte d'Ivoire"},
    {"CL", "56", "Chile"},
    {"CM", "237", "Cameroon"},
    {"CO", "57", "Colombia"},
    {"CR", "506", "Costa Rica"},
    {"CY", "357", "Cyprus"},
    {"CZ", "420", "Czechia"},
    {"DK", "45", "Denmark"},
    {"DO", "1809", "Dominican Republic"},
    {"DZ", "213", "Algeria"},
    {"EC", "593", "Ecuador"},
    {"EE", "372", "Estonia"},
    {"EG", "20", "Egypt"},
    {"ES", "34", "Spain"},
    {"ET", "251", "Ethiopia"},
    {"FI", "358", "Finland"},
    {"FJ", "679", "Fiji"},
    {"GE", "995", "Georgia"},
    {"GH", "233", "Ghana"},
    {"GR", "30", "Greece"},
    {"GT", "502", "Guatemala"},
    {"HK", "852", "Hong Kong"},
    {"HN", "504", "Honduras"},
    {"HR", "385", "Croatia"},
    {"HU", "36", "Hungary"},
    {"ID", "62", "Indonesia"},
    {"IE", "353", "Ireland"},
    {"IL", "972", "Israel"},
    {"IQ", "964", "Iraq"},
    {"IR", "98", "Iran"},
    {"IS", "354", "Iceland"},
    {"IT", "39", "Italy"},
    {"JM", "1876", "Jamaica"},
    {"JO", "962", "Jordan"},
    {"KE", "254", "Kenya"},
    {"KH", "855", "Cambodia"},
    {"KW", "965", "Kuwait"},
    {"KZ", "7", "Kazakhstan"},
    {"LA", "856", "Laos"},
    {"LB", "961", "Lebanon"},
    {"LK", "94", "Sri Lanka"},
    {"LT", "370", "Lithuania"},
    {"LU", "352", "Luxembourg"},
    {"LV", "371", "Latvia"},
    {"LY", "218", "Libya"},
    {"MA", "212", "Morocco"},
    {"MM", "95", "Myanmar"},
    {"MO", "853", "Macau"},
    {"MT", "356", "Malta"},
    {"MY", "60", "Malaysia"},
    {"NG", "234", "Nigeria"},
    {"NL", "31", "Netherlands"},
    {"NO", "47", "Norway"},
    {"NP", "977", "Nepal"},
    {"OM", "968", "Oman"},
    {"PA", "507", "Panama"},
    {"PE", "51", "Peru"},
    {"PH", "63", "Philippines"},
    {"PK", "92", "Pakistan"},
    {"PL", "48", "Poland"},
    {"PT", "351", "Portugal"},
    {"QA", "974", "Qatar"},
    {"RO", "40", "Romania"},
    {"RS", "381", "Serbia"},
    {"RU", "7", "Russia"},
    {"SA", "966", "Saudi Arabia"},
    {"SE", "46", "Sweden"},
    {"SI", "386", "Slovenia"},
    {"SK", "421", "Slovakia"},
    {"SN", "221", "Senegal"},
    {"TN", "216", "Tunisia"},
    {"TR", "90", "Turkey"},
    {"TT", "1868", "Trinidad and Tobago"},
    {"TW", "886", "Taiwan"},
    {"TZ", "255", "Tanzania"},
    {"UA", "380", "Ukraine"},
    {"UG", "256", "Uganda"},
    {"UY", "598", "Uruguay"},
    {"UZ", "998", "Uzbekistan"},
    {"VE", "58", "Venezuela"},
    {"VN", "84", "Vietnam"},
    {"ZA", "27", "South Africa"},
    {"ZW", "263", "Zimbabwe"}
  ]

  @entries Enum.map(@rows, fn {iso2, dial, name} ->
             # flag emoji computed inline (module-attribute expressions cannot
             # call the module's own functions)
             flag =
               case iso2 do
                 <<a, b>> when a in ?A..?Z and b in ?A..?Z ->
                   <<0x1F1E6 + (a - ?A)::utf8, 0x1F1E6 + (b - ?A)::utf8>>

                 _ ->
                   ""
               end

             %{iso2: iso2, dial: dial, name: name, flag: flag}
           end)

  @by_iso Map.new(@entries, fn entry -> {entry.iso2, entry} end)

  @doc "Default country ISO-2 code (matches the Lit `DEFAULT_COUNTRY`)."
  @spec default_country :: String.t()
  def default_country, do: @default_country

  @doc "All dial-code entries, in Lit registry order."
  @spec entries :: [entry(), ...]
  def entries, do: @entries

  @doc "Lookup by ISO-2 code, falling back to the default country."
  @spec lookup_country(String.t()) :: entry()
  def lookup_country(iso2) do
    key = iso2 |> String.trim() |> String.upcase()
    Map.get(@by_iso, key, Map.fetch!(@by_iso, @default_country))
  end

  @doc "Regional-indicator flag emoji for an ISO-2 code (`\"\"` for invalid input)."
  @spec flag_emoji(String.t()) :: String.t()
  def flag_emoji(iso2)

  def flag_emoji(<<a, b>>) when a in ?A..?Z and b in ?A..?Z do
    <<0x1F1E6 + (a - ?A)::utf8, 0x1F1E6 + (b - ?A)::utf8>>
  end

  def flag_emoji(iso2) when is_binary(iso2) do
    case String.upcase(iso2) do
      <<a, b>> when a in ?A..?Z and b in ?A..?Z -> flag_emoji(<<a, b>>)
      _ -> ""
    end
  end

  def flag_emoji(_), do: ""
end
