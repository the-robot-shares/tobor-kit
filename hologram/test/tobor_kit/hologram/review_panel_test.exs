defmodule ToborKit.Hologram.ReviewPanelTest do
  use ExUnit.Case, async: true

  alias ToborKit.Hologram.Review.Panel

  describe "normalize/1" do
    test "keeps map rows, drops junk" do
      rows = Panel.normalize([%{id: "r1"}, "junk", nil, %{id: "r2"}])
      assert Enum.map(rows, & &1.id) == ["r1", "r2"]
    end

    test "non-lists normalize to empty" do
      assert Panel.normalize(nil) == []
      assert Panel.normalize(%{}) == []
      assert Panel.normalize("junk") == []
    end
  end

  describe "review_status/1" do
    test "anything but resolved is open" do
      assert Panel.review_status("resolved") == "resolved"
      assert Panel.review_status(:resolved) == "resolved"
      assert Panel.review_status("open") == "open"
      assert Panel.review_status(nil) == "open"
      assert Panel.review_status("weird") == "open"
    end
  end

  describe "format_stamp/1" do
    test "ISO-8601 prefixes format to `YYYY-MM-DD HH:MM UTC`" do
      assert Panel.format_stamp("2026-09-15T10:30:00Z") == "2026-09-15 10:30 UTC"
    end

    test "non-ISO strings pass through" do
      assert Panel.format_stamp("bogus-stamp") == "bogus-stamp"
      assert Panel.format_stamp(nil) == ""
    end
  end

  test "row accessors are dual-key tolerant" do
    assert Panel.row_id(%{"id" => "r9"}) == "r9"
    assert Panel.row_author(%{author: "Keith"}) == "Keith"
    assert Panel.row_status(%{}) == "open"
  end
end
