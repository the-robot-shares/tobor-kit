defmodule ToborKit.MCP do
  @moduledoc """
  Live MCP tool inventory, filtered and dressed server-side.

  Pipeline per `GET /mcp/tools`:

  1. discover tools from every configured MCP server (`ToborKit.MCP.Source`);
  2. apply the guide's `mcp.allow` / `mcp.deny` globs (deny wins);
  3. apply the `mcp.menu` overlay — labels, groups, order, confirm, hidden.

  Clients render the response verbatim; web and Swift cannot drift because
  the dressing happens here. Unreachable servers surface in `degraded[]` so
  the UI can say so instead of silently showing a short list — unless the
  server was `required`, which is a 502.
  """

  alias ToborKit.Guide

  @doc """
  Build the inventory for `guide`. `refresh: true` bypasses the cache.

  Returns `{:ok, %{groups: [...], tools: [...], degraded: [...]}}` or
  `{:error, {:required_server_down, id}}` when a required server is
  unreachable.
  """
  @spec inventory(Guide.t(), keyword()) ::
          {:ok, map()} | {:error, {:required_server_down, String.t()}}
  def inventory(%Guide{} = guide, opts \\ []) do
    mcp_cfg = guide.config["mcp"] || %{}
    servers = Map.get(mcp_cfg, "servers") || []

    results = discover(servers, Keyword.get(opts, :refresh, false))

    required_down =
      Enum.find(results, fn {server, r} ->
        match?({:error, _}, r) and server["required"] == true
      end)

    case required_down do
      {server, _} ->
        {:error, {:required_server_down, server["id"]}}

      nil ->
        tools =
          results
          |> Enum.filter(fn {_server, result} -> match?({:ok, _}, result) end)
          |> Enum.flat_map(fn {server, {:ok, tools}} -> Enum.map(tools, &{server, &1}) end)
          |> filter(mcp_cfg)
          |> dress(mcp_cfg)

        group_ids = group_ids(tools, mcp_cfg)

        tools =
          Enum.sort_by(tools, fn {tool, _, _} ->
            {Enum.find_index(group_ids, &(&1 == tool["group"])), tool["name"]}
          end)

        degraded =
          results
          |> Enum.filter(fn {_server, r} -> match?({:error, _}, r) end)
          |> Enum.map(fn {server, {:error, reason}} -> degraded(server, reason) end)

        {:ok,
         %{
           "groups" => Enum.map(group_ids, &%{"id" => &1, "label" => &1}),
           "tools" => Enum.map(tools, fn {tool, _, _} -> Map.delete(tool, "hidden") end),
           "degraded" => degraded
         }}
    end
  end

  # ── discovery ─────────────────────────────────────────────────────────────

  defp discover(servers, refresh) do
    cache = ToborKit.MCP.Cache

    Enum.map(servers, fn server ->
      {server, cache.fetch(server, refresh)}
    end)
  end

  defp degraded(server, reason) do
    %{
      "server" => server["id"],
      "label" => server_label(server),
      "error" => error_text(reason)
    }
  end

  defp error_text(reason) when is_binary(reason), do: reason
  defp error_text(reason), do: inspect(reason)

  # ── allow/deny (deny wins) ────────────────────────────────────────────────

  defp filter(pairs, mcp_cfg) do
    allow = Map.get(mcp_cfg, "allow") || []
    deny = Map.get(mcp_cfg, "deny") || []

    Enum.reject(pairs, fn {_server, tool} ->
      name = tool["name"]
      denied?(name, deny) or (allow != [] and not match_any?(name, allow))
    end)
  end

  defp denied?(name, deny), do: match_any?(name, deny)

  defp match_any?(_name, []), do: false

  defp match_any?(name, patterns) do
    Enum.any?(patterns, fn pattern -> ToborKit.MCP.Glob.match?(pattern, name) end)
  end

  # ── menu overlay ──────────────────────────────────────────────────────────

  defp dress(pairs, mcp_cfg) do
    menu = Map.get(mcp_cfg, "menu") || %{}
    overrides = Map.get(menu, "overrides") || %{}
    group_by = Map.get(menu, "group_by") || "category"

    pairs
    |> Enum.map(fn {server, tool} ->
      ov = Map.get(overrides, tool["name"]) || %{}
      {overlay(server, tool, ov, group_by), server, tool}
    end)
    |> Enum.reject(fn {tool, _, _} -> Map.get(tool, "hidden") == true end)
    |> Enum.map(fn {tool, server, raw} -> {tool, server_label(server), raw} end)
  end

  defp overlay(server, tool, ov, group_by) do
    %{
      "name" => tool["name"],
      "label" => get_override(ov, "label") || humanize(tool["name"]),
      "description" => Map.get(tool, "description"),
      "group" => get_override(ov, "group") || default_group(server, tool, group_by),
      "icon" => get_override(ov, "icon"),
      "server" => server["id"],
      "confirm" => truthy(get_override(ov, "confirm")),
      "hidden" => get_override(ov, "hidden") == true,
      "read_only" => Map.get(tool, "read_only"),
      "input_schema" => Map.get(tool, "input_schema")
    }
  end

  defp get_override(ov, key), do: Map.get(ov, key)

  # "category" (default): the qualified-name namespace — "Github.PullCreate" → "Github".
  # Anything else: group by server.
  defp default_group(_server, tool, "category"), do: category_of(tool["name"]) || "Other"

  defp default_group(server, _tool, _other), do: server_label(server)

  # "category" group_by: the qualified-name namespace ("Github.PullCreate" → "Github").
  defp category_of(name) when is_binary(name) do
    case String.split(name, ".", parts: 2) do
      [category, _rest] when category != "" -> category
      _ -> nil
    end
  end

  defp category_of(_), do: nil

  defp server_label(%{"label" => label}) when is_binary(label), do: label
  defp server_label(%{"id" => id}), do: id
  defp server_label(_), do: "Other"

  defp truthy(v) when v in [true, "true", "yes"], do: true
  defp truthy(_), do: false

  defp humanize(name) when is_binary(name) do
    name
    |> String.split(".")
    |> List.last()
    |> String.replace(~r/([a-z\d])([A-Z])/, "\\1 \\2")
    |> String.split(["_", "-", " "], trim: true)
    |> Enum.map_join(" ", &String.capitalize/1)
  end

  defp humanize(other), do: to_string(other)

  defp group_ids(dressed_tools, mcp_cfg) do
    menu = Map.get(mcp_cfg, "menu") || %{}
    order = Map.get(menu, "order") || []

    present =
      dressed_tools
      |> Enum.map(fn {tool, _, _} -> tool["group"] end)
      |> Enum.uniq()

    ordered = Enum.filter(order, &(&1 in present))
    rest = Enum.sort(present -- ordered)

    ordered ++ rest
  end
end

defmodule ToborKit.MCP.Glob do
  @moduledoc "Glob matching for `mcp.allow`/`mcp.deny` patterns (`Github.*`, `*`)."

  @spec match?(String.t(), String.t()) :: boolean()
  def match?(pattern, name) when is_binary(pattern) and is_binary(name) do
    regex =
      pattern
      |> Regex.escape()
      |> String.replace("\\*", ".*")

    Regex.match?(~r/^#{regex}$/, name)
  end
end

defmodule ToborKit.MCP.Cache do
  @moduledoc "Short-lived inventory cache; `refresh: true` on the endpoint bypasses it."

  use GenServer

  @name __MODULE__
  @table :tobor_kit_mcp_cache

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: @name)

  @doc "Cached tools for `server`, or a fresh fetch on miss/expiry/refresh."
  @spec fetch(map(), boolean()) :: {:ok, [map()]} | {:error, term()}
  def fetch(server, refresh?) do
    key = server["id"]

    if refresh? do
      load(server, key)
    else
      case :ets.lookup(@table, key) do
        [{^key, tools, expires_at}] ->
          if System.system_time(:millisecond) < expires_at do
            {:ok, tools}
          else
            load(server, key)
          end

        [] ->
          load(server, key)
      end
    end
  end

  defp load(server, key) do
    case ToborKit.MCP.Source.impl().list_tools(server) do
      {:ok, tools} ->
        ttl = Application.get_env(:tobor_kit, ToborKit.MCP, [])[:cache_ttl_ms] || 30_000
        :ets.insert(@table, {key, tools, System.system_time(:millisecond) + ttl})
        {:ok, tools}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def init(_opts) do
    :ets.new(@table, [:named_table, :set, :public])
    {:ok, %{}}
  end
end
