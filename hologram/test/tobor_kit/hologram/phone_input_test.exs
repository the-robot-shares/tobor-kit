defmodule ToborKit.Hologram.PhoneInputTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.Data.DialCodes
  alias ToborKit.Hologram.PhoneInput.E164
  alias ToborKit.Hologram.PhoneInput.Input

  # — E164 (host-side helpers) —

  test "valid_e164? enforces the ITU shape" do
    assert E164.valid_e164?("+12125550123")
    assert E164.valid_e164?("+442071838750")
    refute E164.valid_e164?("2125550123")
    refute E164.valid_e164?("+02125550123")
    refute E164.valid_e164?("+1212555")
    refute E164.valid_e164?("")
  end

  test "digits_only strips non-digits" do
    assert E164.digits_only("(212) 555-0123") == "2125550123"
  end

  test "to_e164 builds +dial+national, strips trunk zeros and repeated dial codes" do
    assert E164.to_e164("US", "(212) 555-0123") == "+12125550123"
    assert E164.to_e164("GB", "020 7183 8750") == "+442071838750"
    assert E164.to_e164("GB", "442071838750") == "+442071838750"
    assert E164.to_e164("US", "+442071838750") == "+442071838750"
    assert E164.to_e164("US", "00442071838750") == "+442071838750"
    assert E164.to_e164("US", "") == ""
    assert E164.to_e164("US", "   ") == ""
  end

  test "parse_e164 resolves country by longest dial prefix" do
    parsed = E164.parse_e164("+18765551234", "US")
    assert parsed.country == "JM"
    assert parsed.national == "5551234"
    assert parsed.dial == "1876"

    parsed = E164.parse_e164("020 7183 8750", "GB")
    assert parsed == %{country: "GB", national: "2071838750", dial: "44"}

    assert E164.parse_e164("", "US") == nil
  end

  # — Input component helpers —

  test "autocomplete hint flips with mobile_only" do
    assert Input.autocomplete(true) == "tel-national"
    assert Input.autocomplete(false) == "tel"
  end

  test "filter_digits is the regex-free digit filter" do
    assert Input.filter_digits("(212) 555-0123") == "2125550123"
    assert Input.filter_digits("abc") == ""
  end

  test "dial and entries come from the vendored table" do
    assert Input.dial("gb") == "44"
    assert Input.dial("XX") == "1"
    assert Input.entries() == DialCodes.entries()
  end

  test "init splits an incoming E.164 value into country + national display" do
    component = init_input(%{value: "+442071838750"})

    assert component.state.country == "GB"
    assert component.state.national == "2071838750"
    assert component.state.invalid == "false"
  end

  test "init flags invalid values, empty values are valid" do
    assert init_input(%{value: "+12"}).state.invalid == "true"
    assert init_input(%{}).state.invalid == "false"
  end

  test "set_country action updates state and queues country_change" do
    component = init_input(%{})

    result =
      Input.action(
        :set_country,
        %{event: %{value: "gb"}},
        component
      )

    assert result.state.country == "GB"

    action = result.next_action
    assert action.name == :country_change
    assert action.params == %{country: "GB", dial: "+44"}
  end

  test "set_national stores raw input and queues phone_change with digits" do
    component = init_input(%{mobile_only: false})

    result = Input.action(:set_national, %{event: %{value: "(212) 555"}}, component)

    assert result.state.national == "(212) 555"
    assert result.next_action.params == %{value: "212555"}
  end

  test "actions are no-ops when disabled" do
    component = init_input(%{disabled: true})
    assert Input.action(:set_country, %{event: %{value: "GB"}}, component).next_action == nil
    assert Input.action(:set_national, %{event: %{value: "1"}}, component).next_action == nil
  end

  defp init_input(overrides) do
    props =
      Map.merge(
        %{
          country: "US",
          mobile_only: false,
          name: "",
          described_by: "",
          disabled: false,
          value: "",
          target: "parent",
          class: ""
        },
        Map.new(overrides)
      )

    Input.init(props, %Hologram.Component{}, %Hologram.Server{})
  end

  # — rendered HTML —

  @moduletag :render

  test "gallery renders the phone input with registry data-cy hooks" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-phone-input")
    assert html =~ ~s(data-cy="phone.country")
    assert html =~ ~s(data-cy="phone.dial")
    assert html =~ ~s(data-cy="phone.input")
    assert html =~ ~s(data-invalid="false")
    assert html =~ ~s(aria-label="Phone number")
    assert html =~ ~s(inputmode="tel")
    assert html =~ ~s(autocomplete="tel")
    # incoming E.164 value splits into country + national display (+1 → US)
    assert html =~ ~s(<option value="US" selected="true">)
    assert html =~ ~s(data-cy="phone.dial">+1</span>)
    assert html =~ ~s(value="2125550123")
    # picker covers the vendored table — count dial-code options only, since
    # other gallery families (e.g. mcp-domain selects) also emit <option> nodes
    dial_options = Regex.scan(~r/<option value="[A-Z]{2}"/, html)
    assert length(dial_options) == Enum.count(DialCodes.entries())
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
