defmodule ToborKit.Hologram.PromptTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.Prompt.History
  alias ToborKit.Hologram.Prompt.Library

  @moduletag :render

  @prompts [
    %{id: "sys", title: "System", body: "You are a helpful assistant.", starred: true},
    %{id: "brief", title: "Brief", body: "Be concise.", starred: false}
  ]

  # -- Library --

  describe "Library filtering (client-safe ops)" do
    test "filter_prompts/2 matches id, title or body case-insensitively" do
      assert [%{id: "sys"}] = Library.filter_prompts(@prompts, "  HELP  ")
      assert [%{id: "brief"}] = Library.filter_prompts(@prompts, "concise")
      assert @prompts == Library.filter_prompts(@prompts, "")
      assert [] = Library.filter_prompts(@prompts, "zzz")
    end

    test "normalize_query/1 downcases + trims without String.downcase/trim" do
      assert Library.normalize_query("  BeRIEF  ") == "berief"
      assert Library.normalize_query("   ") == ""
    end

    test "contains?/2 is a split-based substring test" do
      assert Library.contains?("hello world", "lo wo")
      refute Library.contains?("hello", "lox")
      assert Library.contains?("hello", "")
    end

    test "matches?/2 covers id, title and body" do
      assert Library.matches?(hd(@prompts), "sys")
      assert Library.matches?(hd(@prompts), "helpful")
    end
  end

  test "Library star helpers update rows in place" do
    assert Library.starred?(@prompts, "sys")
    refute Library.starred?(@prompts, "brief")

    updated = Library.set_starred(@prompts, "brief", true)
    assert Library.starred?(updated, "brief")
    assert Library.starred?(updated, "sys")
    assert Library.star_label(hd(updated)) == "Unstar System"
    assert Library.empty_copy([]) == "No prompts."
    assert Library.empty_copy(@prompts) == "No matching prompts"
  end

  # -- History --

  describe "History stamps" do
    test "format_prompt_stamp/1 renders ISO input as YYYY-MM-DD HH:MM UTC" do
      assert History.format_prompt_stamp("2026-01-01T12:00:00Z") == "2026-01-01 12:00 UTC"
      assert History.format_prompt_stamp("not-a-date") == "not-a-date"
      assert History.format_prompt_stamp(nil) == ""
    end

    test "version_stamp/1 + join_stamp/1 mirror the Lit filter/join" do
      assert History.version_stamp(2) == "v2"
      assert History.version_stamp(nil) == ""
      assert History.join_stamp(["", "2026-01-01 12:00 UTC"]) == "2026-01-01 12:00 UTC"
      assert History.join_stamp(["v1", "2026-01-01 12:00 UTC"]) == "v1 · 2026-01-01 12:00 UTC"
    end
  end

  test "History normalize_entries/1 precomputes stamps" do
    rows =
      History.normalize_entries([
        %{"id" => "e1", "title" => "System", "at" => "2026-01-01T12:00:00Z", "version" => 1},
        %{"id" => "  ", "title" => "ghost"}
      ])

    assert [%{id: "e1", title: "System", stamp: "v1 · 2026-01-01 12:00 UTC", starred: false}] = rows
  end

  test "History normalize_diff/1 normalizes the panes, drops empties" do
    {left, right} =
      History.normalize_diff(%{
        "left" => %{"label" => "v1", "body" => "old"},
        "right" => %{"label" => "v2", "body" => "new"}
      })

    assert left == %{label: "v1", body: "old"}
    assert right == %{label: "v2", body: "new"}
    assert History.normalize_diff(nil) == {nil, nil}
    assert History.normalize_diff(%{"left" => %{}, "right" => nil}) == {nil, nil}
  end

  test "GET /gallery renders the prompt mirrors" do
    html = render_gallery()

    # library: roster with star buttons + selection state, HTML bodies escaped
    assert html =~ ~s(data-cy="prompt.library")
    assert html =~ ~s(data-cy="prompt.item")
    assert html =~ ~s(data-cy="prompt.star")
    assert html =~ ~s(aria-current="false")
    assert html =~ "&lt;section&gt;stays source&lt;/section&gt;"

    # history: rows with precomputed stamps, fork buttons, diff panes
    assert html =~ ~s(data-cy="prompt.history")
    assert html =~ ~s(data-cy="prompt.fork")
    assert html =~ "v1 · 2026-01-01 12:00 UTC"
    assert html =~ "v2 · 2026-02-01 12:00 UTC"
    assert html =~ "You are a helpful assistant."
    assert html =~ "You are a concise assistant."
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
