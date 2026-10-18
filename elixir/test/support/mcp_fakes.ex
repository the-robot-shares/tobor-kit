defmodule ToborKit.MCP.Source.Fake do
  @moduledoc false
  @behaviour ToborKit.MCP.Source

  @inventory [
    %{
      "name" => "Github.PullCreate",
      "description" => "Create a pull request",
      "input_schema" => %{"type" => "object"},
      "read_only" => false
    },
    %{
      "name" => "Github.PullMerge",
      "description" => "Merge a pull request",
      "input_schema" => %{"type" => "object"},
      "read_only" => false
    },
    %{
      "name" => "Github.IssueCreate",
      "description" => "Create an issue",
      "input_schema" => %{"type" => "object"},
      "read_only" => false
    },
    %{
      "name" => "Ticket.Create",
      "description" => "Create a ticket",
      "input_schema" => %{"type" => "object"},
      "read_only" => false
    },
    %{
      "name" => "Session.Create",
      "description" => "Open a work session",
      "input_schema" => %{"type" => "object"},
      "read_only" => false
    },
    %{
      "name" => "Media.Generate",
      "description" => "Generate media (outside allow list)",
      "input_schema" => %{"type" => "object"},
      "read_only" => false
    },
    %{
      "name" => "Files.Read",
      "description" => "Read a file",
      "input_schema" => %{"type" => "object"},
      "read_only" => true
    }
  ]

  @impl true
  def list_tools(%{"id" => "unreachable"}) do
    {:error, :econnrefused}
  end

  def list_tools(_server) do
    case Application.get_env(:tobor_kit, __MODULE__, [])[:error] do
      nil -> {:ok, inventory()}
      reason -> {:error, reason}
    end
  end

  def inventory, do: @inventory
end

defmodule ToborKit.TestSupport.OtelCollector do
  @moduledoc """
  Receives spans from the `:otel_simple_processor` + `:otel_exporter_pid`
  pipeline configured in `config/test.exs`, so tests can assert on span
  attributes without a collector.
  """

  use GenServer

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: :tobor_kit_otel_test)
  end

  def spans do
    GenServer.call(:tobor_kit_otel_test, :spans)
    |> Enum.reverse()
  end

  def clear do
    GenServer.call(:tobor_kit_otel_test, :clear)
  end

  @impl true
  def init(state), do: {:ok, state}

  @impl true
  def handle_info({:span, span}, state) do
    {:noreply, [span | state]}
  end

  def handle_info(_other, state), do: {:noreply, state}

  @impl true
  def handle_call(:spans, _from, state), do: {:reply, state, state}
  def handle_call(:clear, _from, _state), do: {:reply, :ok, []}
end
