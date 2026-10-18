defmodule ToborKit.Hologram.TranscriptViewTest do
  use ExUnit.Case, async: true

  alias ToborKit.Hologram.TranscriptView.View

  describe "not_server_backed?/1" do
    test "accepts the string-keyed load map (template-passed shape)" do
      assert View.not_server_backed?(%{"status" => "not_server_backed"})
    end

    test "accepts the atom-keyed load map" do
      assert View.not_server_backed?(%{status: "not_server_backed"})
    end

    test "rejects ok loads, nil, and other statuses" do
      refute View.not_server_backed?(%{"status" => "ok"})
      refute View.not_server_backed?(nil)
      refute View.not_server_backed?(%{})
    end
  end

  describe "transcript_empty?/2" do
    test "empty only when no turns and no pending text" do
      assert View.transcript_empty?([], "")
      refute View.transcript_empty?([], "pending…")
      refute View.transcript_empty?([%{id: "t"}], "")
    end
  end

  describe "turn helpers" do
    @turn %{
      id: "t2",
      role: "assistant",
      content: "hi",
      tool_calls: [%{name: "search", ok: false, summary: "3 hits"}]
    }

    test "dual-key accessors read string- and atom-keyed maps" do
      assert View.turn_id(%{"id" => "x"}) == "x"
      assert View.turn_id(%{id: "x"}) == "x"
      assert View.turn_role(@turn) == "assistant"
      assert View.turn_content(%{"content" => "c"}) == "c"
    end

    test "tool_calls default to empty for missing/invalid shapes" do
      assert View.turn_tools(%{}) == []
      assert View.turn_tools(%{"tool_calls" => "junk"}) == []
      assert View.turn_has_tools?(@turn)
      refute View.turn_has_tools?(%{})
    end

    test "tool mark and label follow the Lit ternaries" do
      call = hd(@turn.tool_calls)
      assert View.tool_mark(call) == "✗"
      assert View.tool_mark(%{ok: true}) == "✓"
      assert View.tool_mark(%{}) == "✓"
      assert View.tool_label(%{}) == "tool"
      assert View.tool_label(%{name: "search"}) == "search"
      assert View.tool_label(call) == "search — 3 hits"
    end
  end
end
