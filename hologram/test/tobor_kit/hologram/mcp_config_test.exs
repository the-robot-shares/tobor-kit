defmodule ToborKit.Hologram.McpConfigTest do
  use ExUnit.Case, async: true

  alias ToborKit.Hologram.Mcp.Config

  describe "normalize_transport/1" do
    test "keeps valid transports" do
      assert Config.normalize_transport("stdio") == "stdio"
      assert Config.normalize_transport("http") == "http"
      assert Config.normalize_transport("sse") == "sse"
    end

    test "clamps invalid values to http" do
      assert Config.normalize_transport("weird") == "http"
      assert Config.normalize_transport(nil) == "http"
      assert Config.normalize_transport(:stdio) == "http"
    end
  end

  describe "transports/0" do
    test "matches the Lit MCP_TRANSPORTS order" do
      assert Config.transports() == ["stdio", "http", "sse"]
    end
  end

  describe "placeholder/1" do
    test "stdio expects a command path, http/sse a URL" do
      assert Config.placeholder("stdio") == "/usr/local/bin/mcp-server"
      assert Config.placeholder("http") == "https://mcp.example.test/mcp"
      assert Config.placeholder("sse") == "https://mcp.example.test/mcp"
    end
  end

  describe "extras_for_event/1" do
    test "drops nil, junk, and empty maps" do
      assert Config.extras_for_event(nil) == nil
      assert Config.extras_for_event(%{}) == nil
      assert Config.extras_for_event("junk") == nil
    end

    test "passes nonempty extras through" do
      extras = %{"timeoutMs" => 5_000}
      assert Config.extras_for_event(extras) == extras
    end
  end
end
