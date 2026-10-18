defmodule ToborKit.Hologram.TaskMenuTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.TaskMenu.Menu

  @moduletag :render

  describe "logic" do
    test "confirm_label/2 resolves the label of the confirming tool" do
      tools = [%{name: "Gh.Pr", label: "Open a PR", confirm: true}]

      assert Menu.confirm_label("Gh.Pr", tools) == "Open a PR"
      assert Menu.confirm_label("missing", tools) == "missing"
      assert Menu.confirm_label(nil, tools) == ""
    end

    test "flag/1 renders verbatim aria strings" do
      assert Menu.flag(true) == "true"
      assert Menu.flag(false) == "false"
    end
  end

  test "GET /gallery renders the task-menu mirrors" do
    html = render_gallery()

    # trigger (both instances) + registry-style test hooks
    assert html =~ ~s(class="tk tk-task-menu")
    assert html =~ ~s(data-testid="task-menu-trigger")
    assert html =~ ~s(data-testid="task-menu-panel")

    # only the open instance renders the panel content
    assert html =~ "Open a PR"
    assert html =~ "List issues"
    assert html =~ "search unreachable"
    refute html =~ ~s(data-testid="task-menu-empty")

    # confirm-carrying tool keeps its warning marker
    assert html =~ "⚠"
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
