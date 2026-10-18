defmodule ToborKit.Guide.Store do
  @moduledoc """
  Holds the single verified guide this backend serves.

  At boot, reads `config :tobor_kit, ToborKit.Guide.Store, path:` and
  `config:`. A missing path leaves the store empty — `GET /guide` then 404s
  and turns are refused, rather than the server serving a made-up guide.
  """

  use GenServer
  require Logger

  @name __MODULE__

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: @name)
  end

  @doc "The current guide, or {:error, :no_guide}."
  @spec guide() :: {:ok, ToborKit.Guide.t()} | {:error, :no_guide}
  def guide do
    GenServer.call(@name, :guide)
  end

  @doc "Swap the guide at runtime (re-reads and re-verifies the bundle)."
  @spec put(Path.t() | map(), map()) :: {:ok, ToborKit.Guide.t()} | {:error, term()}
  def put(path_or_bundle, config \\ %{}) do
    GenServer.call(@name, {:put, path_or_bundle, config})
  end

  @impl true
  def init(_opts) do
    cfg = Application.get_env(:tobor_kit, __MODULE__, [])
    state = load(Keyword.get(cfg, :path), Keyword.get(cfg, :config) || %{})

    case state do
      {:ok, _} -> :ok
      {:error, reason} -> Logger.warning("tobor_kit guide not loaded: #{inspect(reason)}")
    end

    {:ok, state}
  end

  @impl true
  def handle_call(:guide, _from, state), do: {:reply, state, state}

  def handle_call({:put, path_or_bundle, config}, _from, _state) do
    new_state = load(path_or_bundle, config)
    {:reply, new_state, new_state}
  end

  defp load(nil, _config), do: {:error, :no_guide}

  defp load(path_or_bundle, config) do
    with {:ok, guide} <- ToborKit.Guide.load(path_or_bundle) do
      {:ok, ToborKit.Guide.with_config(guide, config)}
    end
  end
end
