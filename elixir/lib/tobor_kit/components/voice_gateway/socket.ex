defmodule ToborKit.VoiceGateway.Socket do
  @moduledoc """
  The session websocket (wire contract v1). One live connection per session:
  the plug validates the single-use ticket, then this module owns the
  protocol —

    * immediate `{type: "ready", sessionId}` handshake;
    * client frames `input.text|image|screenshot|audio`, `interrupt`,
      `animation` echo, `realtime.event` relay;
    * server frames `transcript`, `text`, `audio`, `animation`,
      `interrupted`, `error`, `realtime.event` — every turn frame carries the
      turn's `turnId`, and frames from superseded turns are dropped by
      generation check;
    * each turn runs in a `Task` so `interrupt` can kill it outright
      (mirroring the Node gateway's AbortController);
    * 8 MiB frame cap (close 1009), 40-message history, session-TTL close.

  Frames are string-keyed maps at the wire boundary per the contract.
  """

  @behaviour WebSock

  require Logger

  alias ToborKit.VoiceGateway
  alias ToborKit.VoiceGateway.{Config, Store}

  @canonical_states ~w(idle listening thinking speaking tool_running error offline)
  @turn_inputs ~w(input.text input.image input.screenshot input.audio)
  @audio_mime_types [
    "audio/webm",
    "audio/webm;codecs=opus",
    "audio/ogg",
    "audio/wav",
    "audio/mp4"
  ]
  @data_url_regex ~r<^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$>
  @base64_regex ~r{^[A-Za-z0-9+/]+=*$}

  defstruct [
    :session_id,
    :config,
    :engine,
    :provider,
    :brain,
    :pid,
    :task,
    :turn_id,
    :max_payload,
    :expires_at,
    generation: 0,
    history: [],
    max_history: 40
  ]

  @impl true
  def init(%{session_id: session_id, max_payload: max_payload}) do
    case Store.attach(session_id, self()) do
      {:ok, row} ->
        cfg = VoiceGateway.config()
        remaining = max(row.expires_at - System.system_time(:millisecond), 0)
        Process.send_after(self(), :vgw_expire, remaining + 100)

        state = %__MODULE__{
          session_id: session_id,
          config: row.config,
          engine: row.config["engine"],
          provider: cfg.provider,
          brain: cfg.brain,
          pid: self(),
          max_payload: max_payload,
          expires_at: row.expires_at
        }

        {:push, {:text, encode(%{"type" => "ready", "sessionId" => session_id})}, state}

      :error ->
        {:stop, :normal, 1000, nil}
    end
  end

  @impl true
  def handle_in({data, _opcode}, state) when byte_size(data) > state.max_payload do
    {:stop, :normal, 1009, state}
  end

  def handle_in({data, [opcode: :text]}, state) do
    case Jason.decode(data) do
      {:ok, %{"type" => type} = message} when is_binary(type) ->
        dispatch(message, state)

      _ ->
        push_error(state, "invalid_message", "Expected a JSON event with a type")
    end
  end

  def handle_in({_data, [opcode: :binary]}, state) do
    push_error(state, "invalid_message", "Expected a JSON event with a type")
  end

  def handle_in(_, state), do: {:stop, :normal, 1009, state}

  # ── frame dispatch ────────────────────────────────────────────────────────

  defp dispatch(%{"type" => "interrupt"}, state), do: cancel(state)

  defp dispatch(%{"type" => "animation", "state" => state_name}, state)
       when state_name in @canonical_states do
    {:push, {:text, encode(%{"type" => "animation", "state" => state_name})}, state}
  end

  defp dispatch(%{"type" => "animation"}, state), do: {:ok, state}

  defp dispatch(%{"type" => "realtime.event"} = message, state),
    do: realtime_event(message, state)

  defp dispatch(message, state), do: turn(message, state)

  # ── interrupt / supersede ─────────────────────────────────────────────────

  defp cancel(state) do
    kill_task(state)

    interrupted =
      if state.turn_id,
        do: %{"type" => "interrupted", "turnId" => state.turn_id},
        else: %{"type" => "interrupted"}

    {:push,
     [
       {:text, encode(interrupted)},
       {:text, encode(%{"type" => "animation", "state" => "listening"})}
     ], %{state | generation: state.generation + 1, task: nil}}
  end

  defp kill_task(%{task: task}) when is_pid(task) do
    if Process.alive?(task), do: Process.exit(task, :kill)
  end

  defp kill_task(_), do: :ok

  # ── turns (input.text / image / screenshot / audio) ───────────────────────

  defp turn(message, state) do
    case validate_input(message, state) do
      :ok ->
        kill_task(state)
        generation = state.generation + 1
        turn_id = ToborKit.UUID.generate()

        {:ok, task} =
          Task.Supervisor.start_child(VoiceGateway.TaskSup, fn ->
            run_turn(message, state, generation, turn_id)
          end)

        {:ok, %{state | generation: generation, turn_id: turn_id, task: task}}

      {:error, code, message} ->
        push_error(state, code, message)
    end
  end

  defp validate_input(%{"type" => type}, _state) when type not in @turn_inputs,
    do: {:error, "invalid_message", "Unsupported event type"}

  defp validate_input(message, state) do
    text = if is_binary(message["text"]), do: message["text"], else: ""

    cond do
      byte_size(text) > 32_000 ->
        {:error, "invalid_message", "Invalid text"}

      message["type"] == "input.text" and String.trim(text) == "" ->
        {:error, "invalid_message", "Text is required"}

      message["type"] in ["input.image", "input.screenshot"] and not valid_image?(message, state) ->
        {:error, "invalid_media", "Expected a PNG, JPEG or WebP data URL"}

      message["type"] == "input.audio" and not valid_audio?(message, state) ->
        {:error, "invalid_media", "Unsupported recorded audio"}

      true ->
        :ok
    end
  end

  defp valid_image?(message, state) do
    image = message["dataUrl"]

    is_binary(image) and Regex.match?(@data_url_regex, image) and
      byte_size(image) <= state.max_payload
  end

  defp valid_audio?(message, state) do
    data = message["data"]

    is_binary(data) and message["mimeType"] in @audio_mime_types and
      Regex.match?(@base64_regex, data) and byte_size(data) <= state.max_payload
  end

  # Runs inside the turn task. Cancellation is the gateway's job — an
  # interrupt kills this process, so no cooperative abort checks are needed.
  defp run_turn(message, state, generation, turn_id) do
    pid = state.pid

    emit = fn frame ->
      send(pid, {:vgw_push, generation, Map.put(frame, "turnId", turn_id)})
    end

    ctx = turn_ctx(state, emit)

    try do
      emit.(%{"type" => "animation", "state" => "thinking"})

      text =
        if message["type"] == "input.audio" do
          bang!(
            state.provider.transcribe(Base.decode64!(message["data"]), message["mimeType"], ctx)
          )
        else
          if(is_binary(message["text"]), do: message["text"], else: "")
        end

      # empty text is "no caption" (JS-falsy parity): default labels apply
      label =
        cond do
          text != "" -> text
          message["type"] == "input.screenshot" -> "Site screenshot"
          true -> "Image"
        end

      emit.(%{"type" => "transcript", "role" => "user", "text" => label, "final" => true})

      user_message = user_message(message, text)

      ctx =
        Map.merge(ctx, %{
          messages: state.history ++ [user_message],
          text: text,
          image: image_of(message)
        })

      reply = bang!(state.provider.respond(ctx))

      send(
        pid,
        {:vgw_history, generation, user_message, %{"role" => "assistant", "content" => reply}}
      )

      emit.(%{"type" => "transcript", "role" => "assistant", "text" => reply, "final" => true})
      emit.(%{"type" => "text", "text" => reply, "final" => true})

      if state.engine != "openai-realtime" do
        emit.(%{"type" => "animation", "state" => "speaking"})
        bang!(state.provider.speak(reply, ctx))
      end

      emit.(%{"type" => "animation", "state" => "idle"})
    catch
      :throw, {:coded, {code, message}} when is_binary(code) and is_binary(message) ->
        send(pid, {:vgw_error, generation, code, message, true})

      :throw, {:coded, reason} ->
        code = if is_atom(reason), do: Atom.to_string(reason), else: "provider_error"
        send(pid, {:vgw_error, generation, code, "Voice provider failed", true})

      kind, reason ->
        Logger.error("voice gateway turn failed: #{inspect(kind)} #{inspect(reason)}")
        send(pid, {:vgw_error, generation, "provider_error", "Voice provider failed", true})
    after
      send(pid, {:vgw_done, generation})
    end
  end

  defp turn_ctx(state, emit) do
    config = state.config

    %{
      config: config,
      emit: emit,
      scope: %{organization: config["organization"], project: config["project"]},
      brain: state.brain
    }
  end

  defp user_message(message, text) do
    content =
      case image_of(message) do
        nil ->
          text

        image ->
          caption = if text == "", do: "Describe this image", else: text

          [
            %{"type" => "text", "text" => caption},
            %{"type" => "image_url", "image_url" => %{"url" => image}}
          ]
      end

    %{"role" => "user", "content" => content}
  end

  defp image_of(message) do
    if message["type"] in ["input.image", "input.screenshot"], do: message["dataUrl"], else: nil
  end

  defp bang!({:ok, value}), do: value
  defp bang!(:ok), do: :ok
  defp bang!({:error, reason}), do: throw({:coded, reason})

  # ── realtime relay (openai-realtime engine) ───────────────────────────────

  defp realtime_event(message, state) do
    event = message["event"]

    cond do
      state.engine != "openai-realtime" ->
        realtime_error(state, "invalid_message")

      not is_map(event) or not is_binary(event["type"]) ->
        realtime_error(state, "invalid_message")

      true ->
        handle_realtime_event(event, state)
    end
  end

  defp handle_realtime_event(event, state) do
    case event["type"] do
      "input_audio_buffer.speech_started" ->
        cancel(state)

      "conversation.item.input_audio_transcription.completed" ->
        push(
          state,
          %{
            "type" => "transcript",
            "role" => "user",
            "text" => to_wire_string(event["transcript"]),
            "final" => true,
            "turnId" => realtime_turn_id(event, "item_id")
          }
        )

      type
      when type in ["response.output_audio_transcript.done", "response.audio_transcript.done"] ->
        push(
          state,
          %{
            "type" => "transcript",
            "role" => "assistant",
            "text" => to_wire_string(event["transcript"]),
            "final" => true,
            "turnId" =>
              realtime_turn_id(event, "item_id") || realtime_turn_id(event, "response_id") ||
                ToborKit.UUID.generate()
          }
        )

      "response.function_call_arguments.done" ->
        relay_tool_call(event, state)

      _ ->
        {:ok, state}
    end
  end

  defp relay_tool_call(event, state) do
    tool = resolve_tool(state, event["name"])

    cond do
      is_nil(tool) ->
        realtime_error(state, "forbidden")

      not valid_arguments?(event) ->
        realtime_error(state, "invalid_message")

      true ->
        generation = state.generation
        pid = state.pid
        kill_task(state)

        {:ok, args} = Jason.decode(event["arguments"] || "{}")

        {:ok, task} =
          Task.Supervisor.start_child(VoiceGateway.TaskSup, fn ->
            ctx = turn_ctx(state, fn frame -> send(pid, {:vgw_push, generation, frame}) end)

            try do
              send(
                pid,
                {:vgw_push, generation, %{"type" => "animation", "state" => "tool_running"}}
              )

              result =
                case state.provider.invoke_tool(tool, args, ctx) do
                  {:ok, result} -> result
                  {:error, _reason} -> throw({:relay_error, :tool_failed})
                end

              send(pid, {:vgw_tool_done, generation, event["call_id"], Jason.encode!(result)})
            catch
              :throw, {:relay_error, _} ->
                send(pid, {:vgw_error, generation, "tool_error", "Realtime event failed", false})

              kind, reason ->
                Logger.error(
                  "voice gateway tool call failed: #{inspect(kind)} #{inspect(reason)}"
                )

                send(
                  pid,
                  {:vgw_error, generation, "provider_error", "Realtime event failed", false}
                )
            after
              send(pid, {:vgw_done, generation})
            end
          end)

        {:ok, %{state | task: task}}
    end
  end

  defp valid_arguments?(event) do
    case Jason.decode(event["arguments"] || "{}") do
      {:ok, args} when is_map(args) -> true
      _ -> false
    end
  end

  defp resolve_tool(state, name) do
    if function_exported?(state.provider, :resolve_tool, 2) do
      state.provider.resolve_tool(state.config["tools"] || [], name)
    else
      Config.resolve_tool(state.config["tools"] || [], name)
    end
  end

  defp realtime_turn_id(event, key) do
    if is_binary(event[key]) and event[key] != "", do: event[key], else: nil
  end

  defp to_wire_string(value) when is_binary(value), do: value
  defp to_wire_string(value), do: if(is_nil(value), do: "", else: to_string(value))

  defp realtime_error(state, code) do
    {:push,
     {:text, encode(%{"type" => "error", "code" => code, "message" => "Realtime event failed"})},
     state}
  end

  # ── task → socket messages ────────────────────────────────────────────────

  @impl true
  def handle_info({:vgw_push, generation, frame}, state) when generation == state.generation do
    {:push, {:text, encode(frame)}, state}
  end

  def handle_info({:vgw_push, _stale, _frame}, state), do: {:ok, state}

  def handle_info({:vgw_history, generation, user_message, assistant_message}, state)
      when generation == state.generation do
    history = state.history ++ [user_message, assistant_message]
    {:ok, %{state | history: Enum.slice(history, -40..-1//1)}}
  end

  def handle_info({:vgw_history, _stale, _, _}, state), do: {:ok, state}

  def handle_info({:vgw_tool_done, generation, call_id, result_json}, state)
      when generation == state.generation do
    frames = [
      %{
        "type" => "realtime.event",
        "event" => %{
          "type" => "conversation.item.create",
          "item" => %{
            "type" => "function_call_output",
            "call_id" => call_id,
            "output" => result_json
          }
        }
      },
      %{"type" => "realtime.event", "event" => %{"type" => "response.create"}}
    ]

    {:push, Enum.map(frames, &{:text, encode(&1)}), %{state | task: nil}}
  end

  def handle_info({:vgw_tool_done, _stale, _, _}, state), do: {:ok, %{state | task: nil}}

  def handle_info({:vgw_error, generation, code, message, turn_error?}, state)
      when generation == state.generation do
    frames =
      if turn_error? do
        [
          {:text,
           encode(%{"type" => "animation", "state" => "error", "turnId" => state.turn_id})},
          {:text,
           encode(%{
             "type" => "error",
             "code" => code,
             "message" => message,
             "turnId" => state.turn_id
           })}
        ]
      else
        [{:text, encode(%{"type" => "error", "code" => code, "message" => message})}]
      end

    {:push, frames, %{state | task: nil}}
  end

  def handle_info({:vgw_error, _stale, _, _, _}, state), do: {:ok, %{state | task: nil}}

  def handle_info({:vgw_done, _generation}, state), do: {:ok, %{state | task: nil}}

  def handle_info(:vgw_expire, state), do: {:stop, :normal, 1000, state}

  def handle_info(_, state), do: {:ok, state}

  @impl true
  def terminate(_reason, state) when is_map(state) do
    Store.delete_session(state.session_id)
    :ok
  end

  def terminate(_reason, _state), do: :ok

  # ── helpers ───────────────────────────────────────────────────────────────

  defp push(state, frame) do
    {:push, {:text, encode(frame)}, state}
  end

  defp push_error(state, code, message) do
    {:push, {:text, encode(%{"type" => "error", "code" => code, "message" => message})}, state}
  end

  defp encode(frame), do: Jason.encode!(frame)
end
