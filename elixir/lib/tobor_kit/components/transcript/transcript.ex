defmodule ToborKit.Transcript do
  @moduledoc """
  Transcript storage seam.

  Contract rule the endpoints enforce: server-backed transcript endpoints are
  only meaningful when `transcript.store` is `backend` AND the configured
  store implements `backend?/0` as true. Client-side stores (`memory`,
  `local`) make the endpoints answer **501** so a misconfigured client fails
  loudly instead of silently showing an empty transcript.

  The library ships `ToborKit.Transcript.Memory` (an ETS ring used as live
  conversation context). Hosts implement the behaviour for a real backend
  store.
  """

  @callback backend?() :: boolean()
  @callback append(String.t(), ToborKit.Turn.t()) :: :ok
  @callback list(String.t(), limit :: pos_integer(), before :: DateTime.t() | nil) ::
              %{turns: [ToborKit.Turn.t()], has_more: boolean()}
  @callback delete(String.t()) :: :ok

  def impl,
    do: Application.get_env(:tobor_kit, __MODULE__, [])[:impl] || ToborKit.Transcript.Memory
end

defmodule ToborKit.Transcript.Memory do
  @moduledoc """
  ETS-backed in-memory transcript. `backend?/0` is **false**: it exists to
  feed prompt context for the running process, not to serve transcript
  history, so `/sessions/{id}/transcript` 501s while this is the store.
  """

  use GenServer
  @behaviour ToborKit.Transcript

  @name __MODULE__
  @table :tobor_kit_transcripts

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: @name)

  @impl true
  def backend?, do: false

  @impl true
  def append(session_id, %ToborKit.Turn{} = turn) do
    GenServer.call(@name, {:append, session_id, turn})
  end

  @impl true
  def list(session_id, limit \\ 200, before \\ nil) do
    turns =
      case :ets.lookup(@table, session_id) do
        [{^session_id, turns}] -> Enum.reverse(turns)
        [] -> []
      end

    turns =
      if before do
        Enum.take_while(turns, fn t -> DateTime.compare(t.created_at, before) == :lt end)
      else
        turns
      end

    page = Enum.take(turns, limit)
    %{turns: page, has_more: length(turns) > length(page)}
  end

  @impl true
  def delete(session_id) do
    :ets.delete(@table, session_id)
    :ok
  end

  @doc "All turns for a session, oldest first — for prompt assembly."
  def all(session_id), do: list(session_id, 1_000_000).turns

  @impl true
  def init(_opts) do
    :ets.new(@table, [:named_table, :set, :public])
    {:ok, %{}}
  end

  @impl true
  def handle_call({:append, session_id, turn}, _from, state) do
    existing =
      case :ets.lookup(@table, session_id) do
        [{^session_id, turns}] -> turns
        [] -> []
      end

    :ets.insert(@table, {session_id, [turn | existing]})
    {:reply, :ok, state}
  end
end
