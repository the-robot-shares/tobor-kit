defmodule ToborKit.VoiceGateway.SocketTest do
  @moduledoc """
  Wire-contract tests for the session websocket, driven through the WebSock
  callbacks the same way `ToborKit.Auth.SocketTest` drives the auth socket —
  no live listener, no provider network. Mirrors the frame coverage of
  `backend/test/server.test.mjs`: ready handshake, every frame type in both
  directions, interruption with stale-output suppression, malformed media
  resilience, realtime relay and allowlisting, 40-message history.
  """

  use ExUnit.Case, async: false

  import Plug.Conn
  import Plug.Test

  alias ToborKit.VoiceGateway.Plug
  alias ToborKit.VoiceGateway.Socket

  @max_payload 8 * 1024 * 1024
  @probe :vgw_socket_probe

  # task→socket control messages the drain helpers route into the socket
  defmacrop is_socket_message(msg) do
    quote do
      is_tuple(unquote(msg)) and tuple_size(unquote(msg)) >= 1 and
        match?(
          t
          when t == :vgw_expire or
                 elem(t, 0) in [:vgw_push, :vgw_history, :vgw_tool_done, :vgw_error, :vgw_done],
          unquote(msg)
        )
    end
  end

  setup do
    :ets.delete_all_objects(:tobor_kit_vgw_sessions)
    :ets.delete_all_objects(:tobor_kit_vgw_tickets)
    Process.register(self(), @probe)

    Application.put_env(:tobor_kit, ToborKit.VoiceGateway,
      provider: ToborKit.VoiceGateway.Providers.Fixture,
      brain: nil,
      auth: ToborKit.VoiceGateway.Auth.Bearer,
      allowed_origins: ["http://allowed.test"],
      public_url: nil,
      session_ttl_ms: 30 * 60_000,
      max_sessions: 100,
      max_payload: @max_payload
    )

    Application.put_env(:tobor_kit, ToborKit.VoiceGateway.Auth.Bearer,
      token: "test-token",
      policy: policy()
    )

    on_exit(fn ->
      Application.delete_env(:tobor_kit, ToborKit.VoiceGateway)
      Application.delete_env(:tobor_kit, ToborKit.VoiceGateway.Auth.Bearer)
    end)

    :ok
  end

  defp policy do
    %{
      "organizations" => ["noizu-labs"],
      "projects" => ["noizu-infra"],
      "backends" => ["litellm"],
      "engines" => ["tts", "elevenlabs", "openai-realtime"],
      "models" => ["fixture-model", "fixture-model-2", "gpt-realtime-mini"],
      "allowSystemPrompt" => true,
      "tools" => %{
        "fixture.echo" => %{
          "description" => "Test echo",
          "invoke" => fn args, scope ->
            send(@probe, {:invoked, args, scope})
            %{"echo" => args, "org" => scope.organization}
          end
        }
      }
    }
  end

  defp config(overrides \\ %{}) do
    Map.merge(
      %{
        "organization" => "noizu-labs",
        "project" => "noizu-infra",
        "backend" => "litellm",
        "engine" => "tts",
        "model" => "fixture-model",
        "tools" => ["fixture.echo"],
        "mcpTools" => [],
        "systemPrompt" => "Be brief"
      },
      overrides
    )
  end

  defp create_socket(overrides \\ %{}) do
    conn =
      conn(:post, "http://backend.test/voice/sessions", Jason.encode!(config(overrides)))
      |> put_req_header("content-type", "application/json")
      |> put_req_header("origin", "http://allowed.test")
      |> put_req_header("authorization", "Bearer test-token")
      |> Plug.call([])

    assert conn.status == 201
    reply = Jason.decode!(conn.resp_body)

    {:push, {:text, ready}, state} =
      Socket.init(%{session_id: reply["sessionId"], max_payload: @max_payload})

    assert Jason.decode!(ready) == %{"type" => "ready", "sessionId" => reply["sessionId"]}
    {state, reply}
  end

  # ── driving helpers ───────────────────────────────────────────────────────

  defp send_frame(state, frame) do
    case Socket.handle_in({Jason.encode!(frame), [opcode: :text]}, state) do
      {:push, batch, state} when is_list(batch) -> {decode_frames(batch), state}
      {:push, {:text, json}, state} -> {[Jason.decode!(json)], state}
      {:ok, state} -> {[], state}
      {:stop, _reason, close, _} -> {:stopped, close}
    end
  end

  defp send_raw(state, raw, opcode \\ :text) do
    case Socket.handle_in({raw, [opcode: opcode]}, state) do
      {:push, batch, state} when is_list(batch) -> {decode_frames(batch), state}
      {:push, {:text, json}, state} -> {[Jason.decode!(json)], state}
      {:ok, state} -> {[], state}
      {:stop, _reason, close, _} -> {:stopped, close}
    end
  end

  defp decode_frames(batch), do: Enum.map(batch, fn {:text, json} -> Jason.decode!(json) end)

  # Drain task→socket control messages until `quiet` ms pass with nothing
  # new. Anything else (e.g. tool invoke probes) is left in the mailbox.
  @socket_messages [:vgw_push, :vgw_history, :vgw_tool_done, :vgw_error, :vgw_done, :vgw_expire]

  defp pump(state, frames \\ [], quiet \\ 300) do
    receive do
      message
      when is_tuple(message) and tuple_size(message) >= 1 and elem(message, 0) in @socket_messages ->
        pump_step(message, state, frames, quiet)
    after
      quiet -> {:frames, frames, state}
    end
  end

  defp pump_step(message, state, frames, quiet) do
    case Socket.handle_info(message, state) do
      {:push, batch, state} when is_list(batch) ->
        pump(state, frames ++ decode_frames(batch), quiet)

      {:push, {:text, json}, state} ->
        pump(state, frames ++ [Jason.decode!(json)], quiet)

      {:ok, state} ->
        pump(state, frames, quiet)

      {:stop, _, _, state} ->
        {:stopped, frames, state}
    end
  end

  # Drain until a frame matches, then stop immediately.
  defp pump_until(state, fun, frames \\ []) do
    receive do
      message
      when is_tuple(message) and tuple_size(message) >= 1 and elem(message, 0) in @socket_messages ->
        case Socket.handle_info(message, state) do
          {:push, batch, state} when is_list(batch) ->
            walk_until(Enum.reverse(decode_frames(batch)), state, fun, frames)

          {:push, {:text, json}, state} ->
            walk_until([Jason.decode!(json)], state, fun, frames)

          {:ok, state} ->
            pump_until(state, fun, frames)

          {:stop, _, _, state} ->
            {:stopped, frames, state}
        end
    after
      2_000 -> flunk("timed out waiting for frame: #{inspect(frames)}")
    end
  end

  defp walk_until([frame | rest], state, fun, frames) do
    frames = frames ++ [frame]

    if fun.(frame) do
      {frames, state}
    else
      walk_until(rest, state, fun, frames)
    end
  end

  defp walk_until([], state, fun, frames), do: pump_until(state, fun, frames)

  defp next_frame(state) do
    receive do
      message
      when is_tuple(message) and tuple_size(message) >= 1 and elem(message, 0) in @socket_messages ->
        case Socket.handle_info(message, state) do
          {:push, {:text, json}, state} -> {Jason.decode!(json), state}
          {:push, batch, state} when is_list(batch) -> {hd(decode_frames(batch)), state}
          {:ok, state} -> next_frame(state)
        end
    after
      2_000 -> flunk("expected a frame")
    end
  end

  defp assert_type(frames, type) do
    assert Enum.any?(frames, &(&1["type"] == type)),
           "expected a #{type} frame in #{inspect(frames)}"
  end

  # Realtime engine sockets need a provider that mints credentials (the Node
  # test overrides provider.mintRealtime the same way).
  defmodule RealtimeMintStub do
    @moduledoc false
    @behaviour ToborKit.VoiceGateway.Provider

    @impl true
    def mint_realtime(_config), do: {:ok, %{"token" => "ephemeral-test"}}

    @impl true
    def respond(_ctx), do: {:ok, "stub"}

    @impl true
    def transcribe(_d, _m, _ctx), do: {:ok, "stub"}

    @impl true
    def speak(_t, _ctx), do: :ok

    @impl true
    def invoke_tool(tool, args, ctx),
      do: ToborKit.VoiceGateway.Provider.invoke_tool(tool, args, ctx)
  end

  defp use_realtime_stub do
    merge_gateway_env(provider: RealtimeMintStub)
  end

  defp merge_gateway_env(opts) do
    cfg = Application.get_env(:tobor_kit, ToborKit.VoiceGateway, [])
    Application.put_env(:tobor_kit, ToborKit.VoiceGateway, Keyword.merge(cfg, opts))
  end

  # ── tests ─────────────────────────────────────────────────────────────────

  test "text turns produce transcript, text, audio and animation frames in contract order" do
    {state, _reply} = create_socket()

    {[], state} = send_frame(state, %{"type" => "input.text", "text" => "hello"})
    {:frames, frames, _state} = pump(state)

    assert %{"type" => "animation", "state" => "thinking", "turnId" => turn_id} = hd(frames)

    user = Enum.find(frames, &(&1["type"] == "transcript" and &1["role"] == "user"))
    assert %{"text" => "hello", "final" => true} = user
    assert user["turnId"] == turn_id

    # the fixture's own tool_running animation arrives inside the turn
    assert Enum.at(frames, 1) == %{
             "type" => "transcript",
             "role" => "user",
             "text" => "hello",
             "final" => true,
             "turnId" => turn_id
           }

    assert Enum.any?(frames, &(&1["type"] == "animation" and &1["state"] == "tool_running"))

    assistant = Enum.find(frames, &(&1["type"] == "transcript" and &1["role"] == "assistant"))
    assert %{"text" => "Sandbox voice reply: hello", "final" => true} = assistant
    assert assistant["turnId"] == turn_id

    text = Enum.find(frames, &(&1["type"] == "text"))
    assert %{"text" => "Sandbox voice reply: hello", "final" => true} = text

    audio = Enum.find(frames, &(&1["type"] == "audio"))
    assert %{"mimeType" => "audio/pcm", "sampleRate" => 24_000} = audio
    assert byte_size(Base.decode64!(audio["data"])) == 480

    assert List.last(frames) == %{"type" => "animation", "state" => "idle", "turnId" => turn_id}
  end

  test "screenshots reach the provider as vision content and are labeled" do
    {state, _reply} = create_socket()

    {[], state} =
      send_frame(state, %{
        "type" => "input.screenshot",
        "dataUrl" => "data:image/png;base64,aGVsbG8=",
        "text" => "Review page"
      })

    {:frames, frames, _} = pump(state)

    user = Enum.find(frames, &(&1["type"] == "transcript" and &1["role"] == "user"))
    assert user["text"] == "Review page"

    assistant = Enum.find(frames, &(&1["type"] == "transcript" and &1["role"] == "assistant"))
    assert assistant["text"] == "Sandbox voice reply: Review page [image received]"
  end

  test "image-only turns default the transcript label" do
    {state, _reply} = create_socket()

    {[], state} =
      send_frame(state, %{"type" => "input.image", "dataUrl" => "data:image/jpeg;base64,aGVsbG8="})

    {:frames, frames, _} = pump(state)

    user = Enum.find(frames, &(&1["type"] == "transcript" and &1["role"] == "user"))
    assert user["text"] == "Image"
  end

  test "recorded audio is transcribed by the provider before the turn" do
    {state, _reply} = create_socket()

    {[], state} =
      send_frame(state, %{
        "type" => "input.audio",
        "data" => Base.encode64("fake-opus-bytes"),
        "mimeType" => "audio/webm",
        "final" => true
      })

    {:frames, frames, _} = pump(state)

    user = Enum.find(frames, &(&1["type"] == "transcript" and &1["role"] == "user"))
    assert user["text"] == "Recorded sandbox voice"
  end

  test "interrupt aborts work and suppresses late upstream frames" do
    {state, _reply} = create_socket()

    {[], state} = send_frame(state, %{"type" => "input.text", "text" => "slow response please"})

    # fixture sleeps 250 ms inside `respond`; the user transcript precedes it
    {frames, state} = pump_until(state, &(&1["type"] == "transcript" and &1["role"] == "user"))
    user = List.last(frames)

    {[interrupted, animation], state} = send_frame(state, %{"type" => "interrupt"})
    assert interrupted == %{"type" => "interrupted", "turnId" => user["turnId"]}
    assert animation == %{"type" => "animation", "state" => "listening"}

    # nothing from the killed turn may arrive afterwards
    {:frames, late, _} = pump(state, [], 400)
    refute Enum.any?(late, &(&1["type"] == "transcript" and &1["role"] == "assistant"))
    refute Enum.any?(late, &(&1["type"] == "audio"))
    assert Enum.all?(late, &(&1["type"] == "animation"))

    # the session survives and answers the next turn
    {[], state} = send_frame(state, %{"type" => "input.text", "text" => "recovered"})
    {:frames, frames, _} = pump(state)

    assert Enum.any?(
             frames,
             &(&1["type"] == "text" and &1["text"] == "Sandbox voice reply: recovered")
           )
  end

  test "a new input supersedes the preceding turn" do
    {state, _reply} = create_socket()

    {[], state} = send_frame(state, %{"type" => "input.text", "text" => "slow first turn"})
    {_, state} = pump_until(state, &(&1["type"] == "transcript" and &1["role"] == "user"))

    {[], state} = send_frame(state, %{"type" => "input.text", "text" => "second wins"})
    {:frames, frames, _} = pump(state, [], 500)

    assert Enum.any?(
             frames,
             &(&1["type"] == "text" and &1["text"] == "Sandbox voice reply: second wins")
           )

    # the superseded turn's late reply is filtered by generation
    refute Enum.any?(frames, &(&1["type"] == "text" and &1["text"] =~ "slow first"))
  end

  test "malformed media and events do not crash the session" do
    {state, _reply} = create_socket()

    {[error], state} = send_raw(state, "{")
    assert error["code"] == "invalid_message"

    {[error], state} =
      send_frame(state, %{"type" => "input.image", "dataUrl" => "https://private.internal"})

    assert error["code"] == "invalid_media"

    {[error], state} =
      send_frame(state, %{
        "type" => "input.audio",
        "data" => "not-a-base64!!",
        "mimeType" => "audio/webm"
      })

    assert error["code"] == "invalid_media"

    {[error], state} = send_frame(state, %{"type" => "input.text", "text" => "   "})

    assert error == %{
             "type" => "error",
             "code" => "invalid_message",
             "message" => "Text is required"
           }

    {[error], state} = send_frame(state, %{"type" => "input.video"})
    assert error["code"] == "invalid_message"

    {[error], state} = send_raw(state, "not json at all")
    assert error["code"] == "invalid_message"

    {[error], state} = send_raw(state, <<1, 2, 3>>, :binary)
    assert error["code"] == "invalid_message"

    {[], state} = send_frame(state, %{"type" => "input.text", "text" => "still works"})
    {:frames, frames, _} = pump(state)

    assert Enum.any?(
             frames,
             &(&1["type"] == "text" and &1["text"] == "Sandbox voice reply: still works")
           )
  end

  test "frames over the transport cap close the socket with 1009" do
    {state, _reply} = create_socket()
    oversized = ~s({"type":"input.text","text":"#{String.duplicate("x", @max_payload)}"})

    assert {:stopped, 1009} = send_raw(state, oversized)
  end

  test "animation echo only repeats canonical states" do
    {state, _reply} = create_socket()

    {[echo], state} = send_frame(state, %{"type" => "animation", "state" => "listening"})
    assert echo == %{"type" => "animation", "state" => "listening"}

    {[], _state} = send_frame(state, %{"type" => "animation", "state" => "dancing"})
  end

  test "realtime transcripts preserve individual turn ids" do
    use_realtime_stub()

    {state, _reply} =
      create_socket(%{"engine" => "openai-realtime", "model" => "gpt-realtime-mini"})

    {frames, state} =
      Enum.map_reduce(["first", "second"], state, fn id, state ->
        send_frame(state, %{
          "type" => "realtime.event",
          "event" => %{
            "type" => "response.output_audio_transcript.done",
            "item_id" => id,
            "transcript" => id
          }
        })
      end)

    assert [%{"turnId" => "first", "text" => "first"}] = hd(frames)
    assert [%{"turnId" => "second", "text" => "second"}] = List.last(frames)
    assert Enum.map(frames, &hd(&1)["role"]) == ["assistant", "assistant"]

    # the realtime engine never emits local speech for text turns
    {[], state} = send_frame(state, %{"type" => "input.text", "text" => "quiet please"})
    {:frames, frames, _} = pump(state)
    refute Enum.any?(frames, &(&1["type"] == "audio"))
  end

  test "speech_started cancels the current realtime turn" do
    use_realtime_stub()

    {state, _reply} =
      create_socket(%{"engine" => "openai-realtime", "model" => "gpt-realtime-mini"})

    {[frame], state} =
      send_frame(state, %{
        "type" => "realtime.event",
        "event" => %{
          "type" => "response.output_audio_transcript.done",
          "item_id" => "t1",
          "transcript" => "t1"
        }
      })

    assert frame["turnId"] == "t1"

    {[interrupted, animation], _state} =
      send_frame(state, %{
        "type" => "realtime.event",
        "event" => %{"type" => "input_audio_buffer.speech_started"}
      })

    assert interrupted["type"] == "interrupted"
    assert animation == %{"type" => "animation", "state" => "listening"}
  end

  test "realtime relay on the tts engine is invalid" do
    {state, _reply} = create_socket(%{"engine" => "tts"})

    {[error], _state} =
      send_frame(state, %{
        "type" => "realtime.event",
        "event" => %{
          "type" => "response.output_audio_transcript.done",
          "item_id" => "x",
          "transcript" => "x"
        }
      })

    assert error["code"] == "invalid_message"
  end

  test "history is capped at 40 wire-shaped messages" do
    {state, _reply} = create_socket()

    state =
      Enum.reduce(1..21, state, fn _, state ->
        {[], state} = send_frame(state, %{"type" => "input.text", "text" => "n"})
        {:frames, _, state} = pump(state, [], 150)
        state
      end)

    assert length(state.history) == 40

    assert List.last(state.history) == %{
             "role" => "assistant",
             "content" => "Sandbox voice reply: n"
           }

    # one user+assistant pair was rotated off the front
    assert hd(state.history) == %{"role" => "user", "content" => "n"}
  end

  test "oversized text content is rejected before the turn starts" do
    {state, _reply} = create_socket()

    {[error], _state} =
      send_frame(state, %{"type" => "input.text", "text" => String.duplicate("x", 32_001)})

    assert error == %{"type" => "error", "code" => "invalid_message", "message" => "Invalid text"}
  end

  test "session expiry closes the socket" do
    merge_gateway_env(session_ttl_ms: 150)

    {state, _reply} = create_socket()
    assert {:stopped, _, 1000, _} = drain_until_stop(state, 2_000)
  end

  defp drain_until_stop(state, timeout) do
    receive do
      message ->
        case Socket.handle_info(message, state) do
          {:stop, reason, close, state} -> {:stopped, reason, close, state}
          {:push, _, state} -> drain_until_stop(state, timeout)
          {:ok, state} -> drain_until_stop(state, timeout)
        end
    after
      timeout -> flunk("expected expiry stop")
    end
  end
end
