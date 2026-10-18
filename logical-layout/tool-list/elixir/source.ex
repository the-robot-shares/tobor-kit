defmodule ToborKit.MCP.Source do
  @moduledoc """
  Tool-inventory source seam.

  The default impl (`NoizuMCP`) connects to each configured MCP server with
  `Noizu.MCP.Client` over the Streamable HTTP transport and lists its tools.
  Tests swap in `ToborKit.MCP.Source.Fake`, which serves a static inventory —
  this module's config seam keeps the network out of unit tests.
  """

  @doc """
  List tools for one server config (`%{"id" => ..., "url" => ..., ...}`).

  Returns `{:ok, tools}` where each tool is a plain map with `name`,
  `description`, `input_schema`, and `read_only` (boolean | nil), or
  `{:error, reason}` when the server could not be reached.
  """
  @callback list_tools(server :: map()) :: {:ok, [map()]} | {:error, term()}

  def impl,
    do: Application.get_env(:tobor_kit, __MODULE__, [])[:impl] || ToborKit.MCP.Source.NoizuMCP
end

defmodule ToborKit.MCP.Source.NoizuMCP do
  @moduledoc """
  Live inventory via `:noizu_mcp` 0.5.

  Each `refresh` starts a throwaway `Noizu.MCP.Client` (Streamable HTTP
  transport), awaits the handshake, auto-paginates `tools/list`, then closes.
  Handshake or listing failure returns `{:error, reason}` — the inventory
  layer turns that into a `degraded[]` entry (or a 502 for `required`
  servers).

  The client only logs transport failures (connection refused, non-2xx), so
  an unreachable server shows up as a handshake timeout: `GenServer.call`
  exits rather than returning. That exit is caught here and the client (and
  its transport) is always closed, so a dead server never crashes the caller
  and no refresh leaks processes.
  """

  @behaviour ToborKit.MCP.Source

  @impl true
  def list_tools(%{"url" => url} = _server) do
    case Noizu.MCP.Client.start_link(
           transport: {Noizu.MCP.Transport.StreamableHTTP.Client, url: url},
           client_info: %{name: "tobor-kit", version: "0.1.0"}
         ) do
      {:ok, client} ->
        # A crashing transport must not take the inventory caller down with it.
        Process.unlink(client)
        fetch_tools(client)

      {:error, reason} ->
        {:error, reason}
    end
  end

  def list_tools(_), do: {:error, :no_url}

  defp normalize(tool) do
    map = Noizu.MCP.Types.Tool.to_map(tool)

    %{
      "name" => map["name"],
      "description" => map["description"],
      "input_schema" => map["inputSchema"],
      "read_only" => get_in(map, ["annotations", "readOnlyHint"])
    }
  end

  defp fetch_tools(client) do
    with :ok <- Noizu.MCP.Client.await_ready(client, timeout()),
         {:ok, tools} <- Noizu.MCP.Client.list_tools(client) do
      {:ok, Enum.map(tools, &normalize/1)}
    else
      {:error, reason} -> {:error, reason}
      error -> {:error, error}
    end
  catch
    :exit, reason -> {:error, {:mcp_unavailable, exit_reason(reason)}}
  after
    # noizu_mcp >= 0.5.3: close/1 deterministically terminates the transport
    # and task supervisor (and tolerates an already-dead client), so the
    # former GenServer.stop(client, :shutdown) workaround is gone.
    Noizu.MCP.Client.close(client)
  end

  # `{:timeout, {GenServer, :call, args}}` → `:timeout`; keeps degraded[] readable.
  defp exit_reason({reason, {GenServer, :call, _}}), do: reason
  defp exit_reason(reason), do: reason

  defp timeout, do: Application.get_env(:tobor_kit, ToborKit.MCP, [])[:request_timeout] || 5_000
end
