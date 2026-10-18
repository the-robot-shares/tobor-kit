defmodule ToborKit.TurnRunner do
  @moduledoc """
  One assistant turn: the SSE turn pipeline.

  Emits contract events as `{:event, name, data}` tuples, in the canonical
  order:

    * `state`         — `{"state" => "thinking"}`
    * `delta` × N     — `{"text" => fragment}` per provider chunk
    * per tool call:  `tool_call` (args only when capture includes
      `tool_args`) → `state` (`tool_running`) → `tool_result`
    * `state`         — `{"state" => "speaking"}`
    * terminal:       `message` (the assistant `Turn` object), OR on failure
      `state` (`error`) then `error` `{"code", "message"}`

  The stream ends ON the terminal event — no trailing idle frame; clients
  return to idle locally.

  Exactly one terminal event is emitted for every run, including replayed
  idempotent turns and provider failures. Errors before any provider work
  (unknown session, turn already in flight, budget) are returned as
  `{:error, reason}` tuples instead of streamed.
  """

  require Logger

  alias ToborKit.Telemetry.Consent

  @doc """
  Run a user turn. `emit` receives every `{:event, name, data}` tuple as it
  is produced. Returns `{:ok, turn}` after the terminal event, or
  `{:error, :not_found} | {:error, :conflict} | {:error, :rate_limited}`.
  """
  @spec run(ToborKit.Session.t() | String.t(), String.t(), keyword(), (tuple() -> any())) ::
          {:ok, ToborKit.Turn.t()} | {:error, term()}
  def run(%ToborKit.Session{id: id} = session, input, opts, emit) do
    # Always operate on the stored session — the caller may hold a stale copy.
    do_run(ToborKit.Session.Store.get(id) || session, input, opts, emit)
  end

  def run(session_id, input, opts, emit) when is_binary(session_id) do
    case ToborKit.Session.Store.get(session_id) do
      nil -> {:error, :not_found}
      session -> do_run(session, input, opts, emit)
    end
  end

  defp do_run(session, input, opts, emit) do
    if session.in_flight do
      {:error, :conflict}
    else
      case ToborKit.Budget.check_budget(opts[:user_id]) do
        :ok -> stream_turn(session, input, opts, emit)
        {:error, :budget_exceeded} -> {:error, :rate_limited}
      end
    end
  end

  defp stream_turn(session, input, opts, emit) do
    {:ok, guide} = ToborKit.Guide.Store.guide()
    consent = Consent.resolve(opts[:user_id], guide.config["telemetry"])

    key = opts[:idempotency_key]

    if is_binary(key) and Map.has_key?(session.idempotency, key) do
      turn = session.idempotency[key]
      emit.({:event, "message", ToborKit.Turn.serialize(turn)})
      {:ok, turn}
    else
      run_fresh(session, input, opts, emit, guide, consent)
    end
  end

  defp run_fresh(session, input, opts, emit, guide, consent) do
    session = ToborKit.Session.Store.update(%{session | in_flight: true, state: "thinking"})
    emit.({:event, "state", %{"state" => "thinking"}})

    prompt = %ToborKit.Prompt{
      system: ToborKit.Guide.system_prompt(guide),
      messages: prompt_messages(session.id, input),
      model: get_in(guide.bundle, ["core", "model"]),
      metadata: %{
        session_id: session.id,
        task_id: opts[:task_id],
        guide_slug: get_in(guide.bundle, ["core", "slug"])
      }
    }

    capture_args? = telemetry_capture(consent)["tool_args"] == true

    result =
      ToborKit.Telemetry.exchange(
        [
          session_id: session.id,
          guide_slug: prompt.metadata.guide_slug,
          model: prompt.model,
          input: input
        ],
        fn ->
          ToborKit.Provider.stream(
            prompt,
            [user_id: opts[:user_id], model: prompt.model],
            fn %{text: text} -> emit.({:event, "delta", %{"text" => text}}) end
          )
          |> case do
            {:ok, completion} ->
              {:ok, %{completion: completion, consent: consent, turn_id: nil}}

            {:error, _} = error ->
              error
          end
        end
      )

    case result do
      {:ok, %{completion: completion}} ->
        finish(session, completion, input, opts, emit, consent, capture_args?)

      {:error, reason} ->
        failure(session, reason, emit)
    end
  rescue
    e ->
      Logger.error("turn failed: " <> Exception.format(:error, e, __STACKTRACE__))
      failure(session, Exception.message(e), emit)
  end

  defp finish(session, completion, input, opts, emit, consent, capture_args?) do
    turn = ToborKit.Turn.from_completion(completion)
    transcript = ToborKit.Transcript.impl()

    # Oldest first: user utterance, then the assistant turn.
    transcript.append(session.id, %ToborKit.Turn{
      id: ToborKit.UUID.generate(),
      role: "user",
      content: input,
      created_at: DateTime.add(turn.created_at, -1, :millisecond)
    })

    transcript.append(session.id, turn)

    # Canonical order per contract: tool_call → state(tool_running) →
    # tool_result, then state(speaking), then the terminal message. The
    # stream ends ON the terminal event — the client returns to idle locally.
    Enum.each(completion.tool_calls, fn tc ->
      call_data =
        %{"id" => tc.id, "name" => tc.name}
        |> then(
          &if capture_args? and Map.get(tc, :args),
            do: Map.put(&1, "args", Map.get(tc, :args)),
            else: &1
        )

      emit.({:event, "tool_call", call_data})

      emit.({:event, "state", %{"state" => "tool_running"}})

      emit.(
        {:event, "tool_result",
         %{"id" => tc.id, "ok" => Map.get(tc, :ok, true), "summary" => Map.get(tc, :summary)}}
      )
    end)

    _ =
      ToborKit.Session.Store.update(%{
        session
        | in_flight: false,
          state: "idle",
          turn_count: session.turn_count + 1,
          idempotency:
            if(is_binary(opts[:idempotency_key]),
              do: Map.put(session.idempotency, opts[:idempotency_key], turn),
              else: session.idempotency
            )
      })

    _ = consent

    emit.({:event, "state", %{"state" => "speaking"}})
    emit.({:event, "message", ToborKit.Turn.serialize(turn)})
    {:ok, turn}
  end

  defp failure(session, reason, emit) do
    ToborKit.Session.Store.update(%{session | in_flight: false, state: "error"})
    emit.({:event, "state", %{"state" => "error"}})
    emit.({:event, "error", %{"code" => "turn_failed", "message" => error_message(reason)}})
    {:error, :streamed}
  end

  defp error_message(reason) when is_binary(reason), do: reason
  defp error_message(:provider_not_configured), do: "The assistant backend is not configured."
  defp error_message(other), do: "The turn failed: " <> inspect(other)

  defp prompt_messages(session_id, input) do
    history =
      ToborKit.Transcript.Memory.all(session_id)
      |> Enum.map(fn turn ->
        role =
          case turn.role do
            "user" -> :user
            "assistant" -> :assistant
            _ -> :system
          end

        %{role: role, content: turn.content}
      end)

    history ++ [%{role: :user, content: input}]
  end

  defp telemetry_capture(%Consent{capture: c}) when is_map(c), do: c
  defp telemetry_capture(_), do: %{}
end
