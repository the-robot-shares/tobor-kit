defmodule ToborKit.Hologram.WikiTest do
  use ExUnit.Case, async: true

  alias ToborKit.Hologram.Wiki.Entry
  alias ToborKit.Hologram.Wiki.Space

  describe "Wiki.Entry" do
    test "plain_text is nil-safe and keeps markup as characters" do
      assert Entry.plain_text("<section>x</section>") == "<section>x</section>"
      assert Entry.plain_text(nil) == ""
      assert Entry.plain_text(42) == "42"
    end

    test "accessors are dual-key tolerant" do
      assert Entry.entry_title(%{"title" => "T"}) == "T"
      assert Entry.entry_title(%{title: "T"}) == "T"
      assert Entry.entry_space(%{"spaceId" => "eng"}) == "eng"
      assert Entry.entry_space(%{}) == ""
    end

    test "no_id? guards the edit affordance" do
      assert Entry.no_id?(%{})
      refute Entry.no_id?(%{id: "x"})
      assert Entry.no_id?(nil)
    end
  end

  describe "Wiki.Space" do
    test "space_selected? compares ids" do
      assert Space.space_selected?(%{id: "eng"}, "eng")
      refute Space.space_selected?(%{id: "eng"}, "ops")
      refute Space.space_selected?(%{}, "eng")
    end

    test "aria_current mirrors the Lit ternary" do
      assert Space.aria_current(true) == "page"
      assert Space.aria_current(false) == "false"
    end
  end
end
