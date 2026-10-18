defmodule ToborKit.Hologram.Data.ToolsTest do
  use ExUnit.Case, async: true

  alias ToborKit.Hologram.Data.Tools

  @inventory %{
    "groups" => [%{"id" => "gh", "label" => "Github"}],
    "tools" => [
      %{"name" => "Gh.Pr", "label" => "Open a PR", "group" => "gh", "confirm" => true},
      %{"name" => "Gh.Issues", "group" => "gh", "read_only" => true,
       "description" => "List issues"},
      %{"name" => "Fs.Write", "group" => "fs"}
    ],
    "degraded" => [%{"server" => "search", "error" => "timeout"}, %{}]
  }

  describe "normalize_inventory/1" do
    test "accepts string-keyed template-passed maps" do
      inv = Tools.normalize_inventory(@inventory)

      assert length(inv.groups) == 1
      assert [%{id: "gh", label: "Github"}] = inv.groups
      assert length(inv.tools) == 3
      assert [%{name: "Gh.Pr", confirm: true, read_only: false}] =
               Enum.filter(inv.tools, &(&1.name == "Gh.Pr"))

      assert [%{server: "search", error: "timeout"}, %{server: nil, error: ""}] = inv.degraded
    end

    test "nil and malformed fall back to the empty inventory" do
      assert Tools.normalize_inventory(nil) == Tools.empty_inventory()
      assert Tools.normalize_inventory(%{}) == Tools.empty_inventory()
      assert Tools.normalize_inventory("nope") == Tools.empty_inventory()
    end

    test "tools without a name are dropped" do
      inv = Tools.normalize_inventory(%{"tools" => [%{"label" => "ghost"}, %{"name" => "ok"}]})
      assert [%{name: "ok"}] = inv.tools
    end
  end

  describe "group_tools/2" do
    test "groups by group id preserving first-seen order, with inventory labels" do
      inv = Tools.normalize_inventory(@inventory)
      groups = Tools.group_tools(inv.tools, Tools.label_map(inv))

      assert [%{id: "gh", label: "Github", tools: [_, _]}, %{id: "fs", label: "fs", tools: [_]}] =
               groups
    end
  end

  describe "visible_inventory/2" do
    test "filters tools + groups to the visible set, passes degraded through" do
      rows = [
        %{name: "Gh.Pr", visibility: :visible},
        %{name: "Gh.Issues", visibility: :discoverable},
        %{name: "Fs.Write", visibility: :disabled}
      ]

      inv = Tools.visible_inventory(rows, @inventory)
      assert [%{name: "Gh.Pr"}] = inv.tools
      assert [%{id: "gh"}] = inv.groups
      assert length(inv.degraded) == 2
    end

    test "synthesizes a single group when no dressed inventory is supplied" do
      inv = Tools.visible_inventory([%{name: "Solo.Tool", visibility: :visible}], nil)

      assert [%{id: "visible", label: "visible"}] = inv.groups
      assert [%{name: "Solo.Tool", label: "Solo.Tool"}] = inv.tools
    end
  end

  test "find_tool/2 and set_row_visibility/3 are client-safe row ops" do
    inv = Tools.normalize_inventory(@inventory)

    assert %{name: "Gh.Pr"} = Tools.find_tool(inv.tools, "Gh.Pr")
    assert nil == Tools.find_tool(inv.tools, "missing")

    rows = [%{name: "a", visibility: :disabled}, %{name: "b", visibility: :visible}]
    updated = Tools.set_row_visibility(rows, "a", :visible)
    assert [%{visibility: :visible}, %{visibility: :visible}] = updated
  end
end
