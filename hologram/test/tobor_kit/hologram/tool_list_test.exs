defmodule ToborKit.Hologram.ToolListTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.ToolList.List

  @moduletag :render

  describe "logic" do
    test "flag/1 renders verbatim aria strings" do
      assert List.flag(true) == "true"
      assert List.flag(false) == "false"
    end
  end

  test "GET /gallery renders the tool-list mirrors" do
    html = render_gallery()

    assert html =~ ~s(class="tk tk-tool-list")

    # inventory section: groups in first-seen order with tools
    assert html =~ "Github"
    assert html =~ "Filesystem"
    assert html =~ "Open a PR"
    assert html =~ "List repository issues"

    # confirm-carrying tool gets the warning badge
    assert html =~ ~s(tk-tool-list__badge--confirm)

    # degraded servers notice with per-server rows
    assert html =~ ~s(data-testid="degraded-servers")
    assert html =~ "search"

    # empty variant renders the empty hook instead of groups
    assert html =~ ~s(data-testid="tools-empty")
    refute html =~ ~s(data-testid="tools-unavailable")
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
