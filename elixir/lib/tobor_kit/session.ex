defmodule ToborKit.Session do
  @moduledoc "A conversation session, per the contract `Session` schema."

  @enforce_keys [:id, :created_at]
  defstruct [
    :id,
    :created_at,
    state: "idle",
    turn_count: 0,
    user: nil,
    locale: "en-US",
    client: "web",
    in_flight: false,
    idempotency: %{}
  ]

  @type t :: %__MODULE__{
          id: String.t(),
          created_at: DateTime.t(),
          state: String.t(),
          turn_count: non_neg_integer(),
          user: %{id: String.t(), email: String.t() | nil, display_name: String.t() | nil} | nil,
          locale: String.t(),
          client: String.t(),
          in_flight: boolean(),
          idempotency: %{String.t() => map()}
        }

  def serialize(%__MODULE__{} = session) do
    %{
      "id" => session.id,
      "created_at" => DateTime.to_iso8601(session.created_at),
      "state" => session.state,
      "turn_count" => session.turn_count,
      "user" => session.user
    }
  end
end

defmodule ToborKit.Session.Store do
  @moduledoc """
  In-memory session registry (the library default).

  A host app backed by Postgres swaps this by implementing the same surface;
  the endpoints only talk to `ToborKit.Session.Store`'s functions.
  """

  use GenServer

  @name __MODULE__
  @table :tobor_kit_sessions

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: @name)

  @spec create(%{user: term(), locale: String.t(), client: String.t()}) :: ToborKit.Session.t()
  def create(attrs \\ %{}) do
    session = %ToborKit.Session{
      id: ToborKit.UUID.generate(),
      created_at: DateTime.utc_now() |> DateTime.truncate(:millisecond),
      user: attrs[:user],
      locale: attrs[:locale] || "en-US",
      client: attrs[:client] || "web"
    }

    GenServer.call(@name, {:put, session})
  end

  @doc "Resume by id. Returns nil for unknown sessions."
  @spec get(String.t()) :: ToborKit.Session.t() | nil
  def get(id) do
    case :ets.lookup(@table, id) do
      [{^id, session}] -> session
      [] -> nil
    end
  end

  def update(%ToborKit.Session{} = session), do: GenServer.call(@name, {:put, session})

  @spec delete(String.t()) :: :ok | :not_found
  def delete(id) do
    if get(id),
      do:
        (
          GenServer.call(@name, {:delete, id})
          :ok
        ),
      else: :not_found
  end

  @impl true
  def init(_opts) do
    :ets.new(@table, [:named_table, :set, :public, read_concurrency: true])
    {:ok, %{}}
  end

  @impl true
  def handle_call({:put, session}, _from, state) do
    :ets.insert(@table, {session.id, session})
    {:reply, session, state}
  end

  def handle_call({:delete, id}, _from, state) do
    :ets.delete(@table, id)
    {:reply, :ok, state}
  end
end
