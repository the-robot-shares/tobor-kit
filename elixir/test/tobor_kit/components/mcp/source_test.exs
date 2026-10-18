defmodule ToborKit.MCP.SourceTest do
  # Exercises the real `NoizuMCP` adapter (not the Fake) against servers that
  # are down or erroring: the caller must get `{:error, _}` — never an exit —
  # and the throwaway client must be closed.
  use ExUnit.Case, async: false

  alias ToborKit.MCP.Source.NoizuMCP

  @mcp_modules [Noizu.MCP.Client, Noizu.MCP.Transport.StreamableHTTP.Client]

  defmodule ErrorPlug do
    @behaviour Plug
    def init(opts), do: opts
    def call(conn, _opts), do: Plug.Conn.send_resp(conn, 503, "unavailable")
  end

  defmodule Ping do
    use Noizu.MCP.Server.Tool,
      name: "ping",
      description: "Ping",
      annotations: [read_only_hint: true]

    input do
      field(:note, :string, description: "Anything")
    end

    @impl true
    def call(_args, _ctx), do: {:ok, %{text: "pong"}}
  end

  defmodule Server do
    use Noizu.MCP.Server, name: "source-test", version: "1.0.0"
    tool(ToborKit.MCP.SourceTest.Ping)
  end

  setup do
    previous = Application.get_env(:tobor_kit, ToborKit.MCP)
    Application.put_env(:tobor_kit, ToborKit.MCP, cache_ttl_ms: 60_000, request_timeout: 300)
    on_exit(fn -> Application.put_env(:tobor_kit, ToborKit.MCP, previous) end)
    :ok
  end

  test "down server returns an error, does not crash, and closes the client" do
    before = mcp_clients()

    assert {:error, {:mcp_unavailable, :timeout}} =
             NoizuMCP.list_tools(%{"url" => "http://127.0.0.1:#{closed_port()}/"})

    assert mcp_clients() -- before == []
  end

  test "server answering non-2xx returns an error and closes the client" do
    {:ok, server} = Bandit.start_link(plug: ErrorPlug, port: 0, ip: :loopback, startup_log: false)
    {:ok, {_ip, port}} = ThousandIsland.listener_info(server)
    before = mcp_clients()

    assert {:error, {:mcp_unavailable, :timeout}} =
             NoizuMCP.list_tools(%{"url" => "http://127.0.0.1:#{port}/"})

    assert mcp_clients() -- before == []
  end

  test "successful listing closes the client and its transport" do
    {:ok, _} = Supervisor.start_link([ToborKit.MCP.SourceTest.Server], strategy: :one_for_one)

    {:ok, server} =
      Bandit.start_link(
        plug: {Noizu.MCP.Transport.StreamableHTTP.Plug, server: ToborKit.MCP.SourceTest.Server},
        port: 0,
        ip: :loopback,
        startup_log: false
      )

    {:ok, {_ip, port}} = ThousandIsland.listener_info(server)
    Application.put_env(:tobor_kit, ToborKit.MCP, cache_ttl_ms: 60_000, request_timeout: 5_000)
    before = mcp_clients()

    assert {:ok, [%{"name" => "ping", "read_only" => true}]} =
             NoizuMCP.list_tools(%{"url" => "http://127.0.0.1:#{port}/"})

    assert mcp_clients() -- before == []
  end

  test "down optional server is marked degraded in the inventory" do
    Application.put_env(:tobor_kit, ToborKit.MCP.Source, impl: NoizuMCP)

    on_exit(fn ->
      Application.put_env(:tobor_kit, ToborKit.MCP.Source, impl: ToborKit.MCP.Source.Fake)
    end)

    :ets.delete_all_objects(:tobor_kit_mcp_cache)

    config = %{
      "mcp" => %{
        "servers" => [
          %{
            "id" => "dead",
            "url" => "http://127.0.0.1:#{closed_port()}/",
            "label" => "Dead",
            "required" => false
          }
        ]
      }
    }

    {:ok, guide} =
      ToborKit.Guide.load(Path.expand("../../../fixtures/deploy-guide.bundle.json", __DIR__))

    assert {:ok, inv} = ToborKit.MCP.inventory(ToborKit.Guide.with_config(guide, config))
    assert [%{"server" => "dead", "label" => "Dead", "error" => error}] = inv["degraded"]
    assert error =~ "mcp_unavailable"
    assert inv["tools"] == []
  end

  # A port nothing listens on: bind an ephemeral port, then release it.
  defp closed_port do
    {:ok, socket} = :gen_tcp.listen(0, ip: {127, 0, 0, 1})
    {:ok, port} = :inet.port(socket)
    :gen_tcp.close(socket)
    port
  end

  defp mcp_clients do
    for pid <- Process.list(),
        {:dictionary, dict} <- [Process.info(pid, :dictionary)],
        match?({mod, :init, 1} when mod in @mcp_modules, dict[:"$initial_call"]),
        do: pid
  end
end
