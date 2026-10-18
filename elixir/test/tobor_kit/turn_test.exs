defmodule ToborKit.TurnTest do
  use ExUnit.Case, async: false

  import ExUnit.CaptureLog

  setup do
    {:ok, session: ToborKit.Session.Store.create()}
  end

  test "end-to-end turn on the Fake provider streams contract events with one terminal event" do
    session = ToborKit.Session.Store.create()

    {:ok, turn} =
      ToborKit.TurnRunner.run(session, "is the branch green?", [], fn event ->
        send(self(), event)
      end)

    events = collect_events()
    names = Enum.map(events, &elem(&1, 1))

    assert hd(names) == "state"
    assert List.last(names) == "message"
    assert Enum.count(names, &(&1 == "message")) == 1
    refute "error" in names

    [first | rest] = events
    assert first == {:event, "state", %{"state" => "thinking"}}

    assert [{:event, "state", %{"state" => "speaking"}}, {:event, "message", message_event}] =
             Enum.take(rest, -2)

    # Stream ends on the terminal event — no trailing idle frame.
    refute "idle" in names

    deltas =
      for {:event, "delta", %{"text" => t}} <- rest, into: "", do: t

    assert deltas == "Acknowledged: is the branch green?"

    assert message_event["id"] == turn.id
    assert message_event["role"] == "assistant"
    assert message_event["content"] == "Acknowledged: is the branch green?"

    assert turn.usage.input_tokens > 0 and turn.usage.output_tokens > 0

    # Transcript carries the user + assistant turns, oldest first.
    history = ToborKit.Transcript.Memory.all(session.id)
    assert ["user", "assistant"] = Enum.map(history, & &1.role)

    # Session counter advanced and the in-flight flag cleared.
    updated = ToborKit.Session.Store.get(session.id)
    assert updated.turn_count == 1
    refute updated.in_flight
  end

  test "turn on unknown session is a not_found" do
    assert {:error, :not_found} =
             ToborKit.TurnRunner.run(ToborKit.UUID.generate(), "hi", [], fn _ -> :ok end)
  end

  test "second concurrent turn is a conflict" do
    session = ToborKit.Session.Store.create()
    ToborKit.Session.Store.update(%{session | in_flight: true})

    assert {:error, :conflict} =
             ToborKit.TurnRunner.run(session, "hello", [], fn _ -> :ok end)
  end

  test "idempotency_key replays the original turn without re-running the provider" do
    session = ToborKit.Session.Store.create()
    emit = fn event -> send(self(), event) end

    {:ok, turn1} = ToborKit.TurnRunner.run(session, "first", [idempotency_key: "k1"], emit)
    _ = collect_events()

    {:ok, turn2} = ToborKit.TurnRunner.run(session, "second", [idempotency_key: "k1"], emit)
    events = collect_events()

    assert turn1.id == turn2.id
    # Replay: only the terminal message — no thinking state, no deltas.
    assert events == [{:event, "message", ToborKit.Turn.serialize(turn1)}]
  end

  test "tool calls emit tool_call/tool_result; args only when capture includes tool_args" do
    Application.put_env(:tobor_kit, ToborKit.Provider.Fake,
      tool_calls: [
        %{
          id: "tc1",
          name: "Github.PullCreate",
          args: %{"title" => "x"},
          ok: true,
          summary: "PR opened"
        }
      ]
    )

    on_exit(fn -> Application.delete_env(:tobor_kit, ToborKit.Provider.Fake) end)

    session = ToborKit.Session.Store.create()
    {:ok, _} = ToborKit.TurnRunner.run(session, "open a pr", [], fn e -> send(self(), e) end)
    events = collect_events()
    names = Enum.map(events, &elem(&1, 1))

    assert "tool_call" in names and "tool_result" in names

    {:event, "tool_call", call} = Enum.find(events, fn e -> elem(e, 1) == "tool_call" end)
    assert call["name"] == "Github.PullCreate"
    # Default test telemetry capture has tool_args: false → no args on the wire.
    refute Map.has_key?(call, "args")

    {:event, "tool_result", result} = Enum.find(events, fn e -> elem(e, 1) == "tool_result" end)
    assert result == %{"id" => "tc1", "ok" => true, "summary" => "PR opened"}

    # Terminal message still exactly once.
    assert Enum.count(names, &(&1 == "message")) == 1
  end

  test "canonical SSE order with tool calls: tool_running between call and result, ends on message" do
    Application.put_env(:tobor_kit, ToborKit.Provider.Fake,
      tool_calls: [
        %{id: "tc9", name: "Ticket.Create", args: %{"t" => "x"}, ok: true, summary: "filed"}
      ]
    )

    on_exit(fn -> Application.delete_env(:tobor_kit, ToborKit.Provider.Fake) end)

    session = ToborKit.Session.Store.create()
    {:ok, _} = ToborKit.TurnRunner.run(session, "file it", [], fn e -> send(self(), e) end)

    events = collect_events()

    assert Enum.map(events, &elem(&1, 1)) == [
             "state",
             "delta",
             "delta",
             "tool_call",
             "state",
             "tool_result",
             "state",
             "message"
           ]

    # state payloads: thinking → tool_running → speaking; no trailing idle —
    # the stream ends on the terminal event.
    state_payloads =
      for {:event, "state", %{"state" => st}} <- events do
        st
      end

    assert state_payloads == ["thinking", "tool_running", "speaking"]
  end

  test "provider failure emits state error + terminal error event" do
    Application.put_env(:tobor_kit, ToborKit.Provider.Fake, error: :backend_down)

    on_exit(fn -> Application.delete_env(:tobor_kit, ToborKit.Provider.Fake) end)

    session = ToborKit.Session.Store.create()

    capture_log(fn ->
      assert {:error, :streamed} =
               ToborKit.TurnRunner.run(session, "hi", [], fn e -> send(self(), e) end)
    end)

    events = collect_events()
    names = Enum.map(events, &elem(&1, 1))

    assert List.last(names) == "error"
    assert Enum.count(names, &(&1 in ["message", "error"])) == 1
    assert "error" in MapSet.new(events |> Enum.map(&elem(&1, 2)["state"]))

    {:event, "error", %{"code" => "turn_failed", "message" => msg}} = List.last(events)
    assert msg =~ "backend_down"
  end

  test "unconfigured provider dark-launches with a terminal error" do
    Application.put_env(:tobor_kit, ToborKit.Provider.Fake, configured: false)
    on_exit(fn -> Application.delete_env(:tobor_kit, ToborKit.Provider.Fake) end)

    session = ToborKit.Session.Store.create()

    capture_log(fn ->
      assert {:error, :streamed} =
               ToborKit.TurnRunner.run(session, "hi", [], fn e -> send(self(), e) end)
    end)

    events = collect_events()

    assert {:event, "error", %{"message" => "The assistant backend is not configured."}} =
             List.last(events)
  end

  defp collect_events do
    receive_events([])
    |> Enum.reverse()
  end

  defp receive_events(acc) do
    receive do
      {:event, _, _} = event -> receive_events([event | acc])
    after
      50 -> acc
    end
  end
end
