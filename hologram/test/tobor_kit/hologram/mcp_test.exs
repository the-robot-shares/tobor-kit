defmodule ToborKit.Hologram.McpTest do
  use ExUnit.Case, async: false

  alias ToborKit.Hologram.Mcp.Clients
  alias ToborKit.Hologram.Mcp.Domain

  @moduletag :render

  describe "Clients.normalize_clients/1" do
    test "derives status kind, clamps auth, labels auth" do
      rows =
        Clients.normalize_clients([
          %{"id" => "gh", "name" => "GitHub", "status" => "Connected", "auth" => "api-key"},
          %{"id" => "sr", "status" => "Authorization Failed"},
          %{"id" => "  ", "name" => "ghost"},
          "junk"
        ])

      assert [%{id: "gh"}, %{id: "sr"}] = rows
      assert hd(rows).kind == "connected"
      assert hd(rows).auth == "api-key"
      assert hd(rows).auth_label == "API key"

      assert Enum.at(rows, 1).kind == "authorization_failed"
      assert Enum.at(rows, 1).auth == "oauth"
      assert Enum.at(rows, 1).auth_label == "OAuth"
      assert Enum.at(rows, 1).name == "sr"
    end

    test "nil / malformed rosters normalize to []" do
      assert Clients.normalize_clients(nil) == []
      assert Clients.normalize_clients("nope") == []
    end
  end

  describe "Domain normalization" do
    test "normalize_visibility/1 clamps to the tri-state union" do
      assert Domain.normalize_visibility("visible") == :visible
      assert Domain.normalize_visibility(:discoverable) == :discoverable
      assert Domain.normalize_visibility("disabled") == :disabled
      assert Domain.normalize_visibility("bogus") == :disabled
      assert Domain.normalize_visibility(nil) == :disabled
    end

    test "normalize_domain_tools/2 labels from inventory + sanitizes select ids" do
      labels = %{"Gh.Pr" => "Open a PR"}
      rows = Domain.normalize_domain_tools([%{"name" => "Gh.Pr", "visibility" => "visible"}, %{}], labels)

      assert [%{name: "Gh.Pr", label: "Open a PR", visibility: :visible, select_id: id}] = rows
      assert id == "vis-Gh-Pr"
    end

    test "caption/1 spells each state" do
      assert Domain.caption(:visible) == "Visible"
      assert Domain.caption(:discoverable) == "Discoverable"
      assert Domain.caption(:disabled) == "Disabled"
    end
  end

  test "GET /gallery renders the mcp mirrors" do
    html = render_gallery()

    # clients roster with status kinds and per-client actions
    assert html =~ ~s(data-cy="mcp.clients")
    assert html =~ ~s(data-kind="connected")
    assert html =~ ~s(data-kind="disconnected")
    assert html =~ ~s(data-cy="mcp.authorize")
    assert html =~ ~s(data-cy="mcp.revoke")
    assert html =~ "API key"

    # domain tool rows: one tri-state select per tool, current state selected
    assert html =~ ~s(data-cy="mcp.domain")
    assert html =~ ~s(data-cy="mcp.tool")
    assert html =~ ~s(id="vis-Github-PullCreate")
    assert html =~ ~s(selected="true")
    assert html =~ ">Visible</option>"
    assert html =~ ">Discoverable</option>"
    assert html =~ ">Disabled</option>"
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
