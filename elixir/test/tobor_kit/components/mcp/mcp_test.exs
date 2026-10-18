defmodule ToborKit.MCPTest do
  use ExUnit.Case, async: false

  @guide_config %{
    "mcp" => %{
      "servers" => [
        %{
          "id" => "tobor",
          "url" => "https://tobor.locker/mcp",
          "label" => "Tobor",
          "required" => true
        }
      ],
      "allow" => ["Github.*", "Ticket.*", "Session.*"],
      "deny" => ["Github.PullMerge"],
      "menu" => %{
        "group_by" => "category",
        "order" => ["Github", "Ticket", "Session"],
        "overrides" => %{
          "Github.PullCreate" => %{"label" => "Open a PR", "confirm" => true},
          "Ticket.Create" => %{"label" => "File a ticket", "group" => "Ticket"}
        }
      }
    }
  }

  defp guide do
    {:ok, guide} = ToborKit.Guide.load(fixture_path())
    ToborKit.Guide.with_config(guide, @guide_config)
  end

  defp fixture_path, do: Path.expand("../../../fixtures/deploy-guide.bundle.json", __DIR__)

  setup do
    # Deterministic inventory + a clean cache per test.
    Application.put_env(:tobor_kit, ToborKit.MCP, cache_ttl_ms: 60_000)
    Application.delete_env(:tobor_kit, ToborKit.MCP.Source.Fake)
    :ets.delete_all_objects(:tobor_kit_mcp_cache)
    :ok
  end

  test "menu overlay is applied server-side: labels, groups, order, confirm" do
    {:ok, inv} = ToborKit.MCP.inventory(guide())

    groups = inv["groups"]
    assert Enum.map(groups, & &1["id"]) == ["Github", "Ticket", "Session"]

    tools = inv["tools"]
    names = Enum.map(tools, & &1["name"])

    # allow/deny applied before dressing.
    assert "Github.PullMerge" not in names
    assert "Media.Generate" not in names
    assert "Files.Read" not in names

    pull_create = Enum.find(tools, &(&1["name"] == "Github.PullCreate"))
    assert pull_create["label"] == "Open a PR"
    assert pull_create["group"] == "Github"
    assert pull_create["confirm"] == true
    assert pull_create["server"] == "tobor"

    ticket = Enum.find(tools, &(&1["name"] == "Ticket.Create"))
    assert ticket["label"] == "File a ticket"
    assert ticket["group"] == "Ticket"

    # Un-overridden tools get a humanized default label.
    issue = Enum.find(tools, &(&1["name"] == "Github.IssueCreate"))
    assert issue["label"] == "Issue Create"
    assert issue["confirm"] == false

    # Tools render sorted within their group order.
    github_names = tools |> Enum.filter(&(&1["group"] == "Github")) |> Enum.map(& &1["name"])
    assert github_names == ["Github.IssueCreate", "Github.PullCreate"]
  end

  test "unreachable server surfaces in degraded[]" do
    config =
      @guide_config
      |> put_in(["mcp", "servers"], [
        %{
          "id" => "tobor",
          "url" => "https://tobor.locker/mcp",
          "label" => "Tobor",
          "required" => false
        },
        %{
          "id" => "unreachable",
          "url" => "https://dead/mcp",
          "label" => "Dead",
          "required" => false
        }
      ])

    guide = ToborKit.Guide.with_config(guide(), config)
    {:ok, inv} = ToborKit.MCP.inventory(guide)

    assert [%{"server" => "unreachable", "label" => "Dead", "error" => _}] = inv["degraded"]
    assert inv["tools"] != []
  end

  test "a required server being down is a 502-shaped error" do
    config =
      @guide_config
      |> put_in(["mcp", "servers"], [
        %{
          "id" => "unreachable",
          "url" => "https://dead/mcp",
          "label" => "Dead",
          "required" => true
        }
      ])

    guide = ToborKit.Guide.with_config(guide(), config)
    assert {:error, {:required_server_down, "unreachable"}} = ToborKit.MCP.inventory(guide)
  end

  test "hidden overrides drop the tool from the response" do
    config =
      @guide_config
      |> put_in(["mcp", "menu", "overrides", "Github.IssueCreate"], %{"hidden" => true})

    guide = ToborKit.Guide.with_config(guide(), config)
    {:ok, inv} = ToborKit.MCP.inventory(guide)
    refute "Github.IssueCreate" in Enum.map(inv["tools"], & &1["name"])
  end

  test "cache serves repeat calls; refresh bypasses it" do
    {:ok, inv1} = ToborKit.MCP.inventory(guide())
    {:ok, inv2} = ToborKit.MCP.inventory(guide())
    assert inv1["tools"] == inv2["tools"]

    # Flip the source to error mode: cached call still works, refresh fails.
    Application.put_env(:tobor_kit, ToborKit.MCP.Source.Fake, error: :down)

    {:ok, _} = ToborKit.MCP.inventory(guide())

    assert {:error, {:required_server_down, "tobor"}} =
             ToborKit.MCP.inventory(guide(), refresh: true)

    Application.delete_env(:tobor_kit, ToborKit.MCP.Source.Fake)
  end

  test "glob semantics" do
    assert ToborKit.MCP.Glob.match?("Github.*", "Github.PullCreate")
    assert ToborKit.MCP.Glob.match?("*", "anything.at.all")
    refute ToborKit.MCP.Glob.match?("Github.*", "Ticket.Create")
    refute ToborKit.MCP.Glob.match?("Github", "Github.PullCreate")
  end
end
