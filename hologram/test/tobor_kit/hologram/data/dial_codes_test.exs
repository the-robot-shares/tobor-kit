defmodule ToborKit.Hologram.Data.DialCodesTest do
  use ExUnit.Case, async: true

  alias ToborKit.Hologram.Data.DialCodes

  describe "entries/0" do
    test "iso2 codes are unique" do
      iso2s = DialCodes.entries() |> Enum.map(& &1.iso2)
      assert length(iso2s) == length(Enum.uniq(iso2s))
    end

    test "dial codes are non-empty digit strings" do
      for entry <- DialCodes.entries() do
        assert entry.dial != "", "empty dial for #{entry.iso2}"
        assert String.match?(entry.dial, ~r/^\d+$/), "bad dial for #{entry.iso2}: #{entry.dial}"
      end
    end

    test "iso2 codes are uppercase A–Z pairs" do
      for entry <- DialCodes.entries() do
        assert String.match?(entry.iso2, ~r/^[A-Z]{2}$/), "bad iso2: #{entry.iso2}"
      end
    end

    test "flags are two regional-indicator codepoints (one grapheme)" do
      for entry <- DialCodes.entries() do
        assert length(String.codepoints(entry.flag)) == 2, "bad flag for #{entry.iso2}"
      end
    end

    test "expected entries present (US +1, KH +855)" do
      us = DialCodes.lookup_country("US")
      assert us.dial == "1"
      assert us.name == "United States"

      kh = DialCodes.lookup_country("KH")
      assert kh.dial == "855"
      assert kh.flag == "🇰🇭"
    end
  end

  describe "lookup_country/1" do
    test "is case/whitespace tolerant" do
      assert DialCodes.lookup_country(" kh ").iso2 == "KH"
    end

    test "falls back to the default country" do
      assert DialCodes.lookup_country("XX").iso2 == DialCodes.default_country()
    end
  end

  describe "flag_emoji/1" do
    test "computes regional indicators" do
      assert DialCodes.flag_emoji("US") == "🇺🇸"
    end

    test "lowercase and invalid input" do
      assert DialCodes.flag_emoji("us") == "🇺🇸"
      assert DialCodes.flag_emoji("USA") == ""
      assert DialCodes.flag_emoji("") == ""
    end
  end
end
