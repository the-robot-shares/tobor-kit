defmodule ToborKit.VoiceGateway.Store do
  @moduledoc """
  Session and single-use-ticket state: two public ETS tables owned by this
  GenServer, swept for expiry every 10 seconds. No external state store —
  sessions live and die with the BEAM, matching the Node gateway's
  in-process map. Disconnect (socket terminate) removes the session; a
  reconnect always creates a new one.
  """

  use GenServer

  @reap_interval 10_000

  @table :tobor_kit_vgw_sessions
  @tickets :tobor_kit_vgw_tickets

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    :ets.new(@table, [:set, :public, :named_table, read_concurrency: true])
    :ets.new(@tickets, [:set, :public, :named_table, read_concurrency: true])
    schedule_reap()
    {:ok, %{}}
  end

  # ── sessions ──────────────────────────────────────────────────────────────

  @doc "Insert a session row: `%{session_id, config, expires_at, pid}`."
  def put_session(%{session_id: id} = row), do: :ets.insert(@table, {id, row})

  @doc "Current row or nil (expired rows are removed on sight)."
  def get_session(id) do
    case :ets.lookup(@table, id) do
      [{^id, row}] ->
        if fresh?(row) do
          row
        else
          :ets.delete(@table, id)
          nil
        end

      [] ->
        nil
    end
  end

  @doc "Number of live (unexpired) sessions — the capacity ceiling input."
  def count do
    now = System.system_time(:millisecond)

    :ets.select_count(@table, [
      {{:"$1", :"$2"}, [{:>, {:map_get, :expires_at, :"$2"}, now}], [true]}
    ])
  end

  @doc """
  Bind the websocket process to a live session — exactly once. Returns the
  row on first attach; `:error` for unknown/expired/already-attached sessions.
  """
  def attach(id, pid) do
    GenServer.call(__MODULE__, {:attach, id, pid})
  end

  @doc "Remove the session (disconnect, expiry)."
  def delete_session(id) do
    case :ets.lookup(@table, id) do
      [{^id, row}] ->
        :ets.delete(@table, id)

        case row.ticket do
          ticket when is_binary(ticket) -> :ets.delete(@tickets, ticket)
          _ -> :ok
        end

      [] ->
        :ok
    end
  end

  # ── tickets ───────────────────────────────────────────────────────────────

  @doc "Insert a single-use ticket bound to a session."
  def put_ticket(ticket, session_id, expires_at) do
    :ets.insert(@tickets, {ticket, session_id, expires_at})
  end

  @doc """
  Consume a ticket for `session_id` — true at most once per ticket. The
  delete is the single-use enforcement.
  """
  def consume_ticket(ticket, session_id) when is_binary(ticket) do
    case :ets.lookup(@tickets, ticket) do
      [{^ticket, ^session_id, _expires}] -> :ets.delete(@tickets, ticket)
      _ -> false
    end
  end

  def consume_ticket(_, _), do: false

  # ── server ────────────────────────────────────────────────────────────────

  @impl true
  def handle_call({:attach, id, pid}, _from, state) do
    reply =
      case get_session(id) do
        %{pid: nil} = row ->
          put_session(%{row | pid: pid})
          {:ok, %{row | pid: pid}}

        _ ->
          :error
      end

    {:reply, reply, state}
  end

  @impl true
  def handle_info(:reap, state) do
    now = System.system_time(:millisecond)

    :ets.foldl(
      fn {id, row}, _ ->
        cond do
          row.expires_at > now ->
            :ok

          is_pid(row.pid) ->
            send(row.pid, :vgw_expire)
            :ets.delete(@table, id)

          true ->
            delete_session(id)
        end

        :ok
      end,
      :ok,
      @table
    )

    :ets.select_delete(@tickets, [{{:"$1", :"$2", :"$3"}, [{:<, :"$3", now}], [true]}])
    schedule_reap()
    {:noreply, state}
  end

  defp fresh?(%{expires_at: expires}), do: expires > System.system_time(:millisecond)

  defp schedule_reap, do: Process.send_after(self(), :reap, @reap_interval)
end
