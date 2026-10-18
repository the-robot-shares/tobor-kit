defmodule ToborKit.VoiceGateway.ProvidersTest do
  @moduledoc """
  Provider-level unit tests with canned frames — no network, mirroring the
  non-HTTP parts of `backend/test/providers.test.mjs`: fixture frame shapes,
  PCM pass-through, tool-name aliasing, policy validation, realtime mint
  shape (via the injected HTTP seam) and the tts engine's brain/STT/TTS seams.
  """

  use ExUnit.Case, async: false

  alias ToborKit.VoiceGateway.Config
  alias ToborKit.VoiceGateway.Providers.{Fixture, OpenAIRealtime, Tts}

  setup do
    on_exit(fn ->
      Application.delete_env(:tobor_kit, ToborKit.VoiceGateway.Providers.OpenAIRealtime)
      Application.delete_env(:tobor_kit, ToborKit.VoiceGateway.Providers.Tts)
    end)

    :ok
  end

  defp emit_collector do
    pid = self()
    fn frame -> send(pid, {:emitted, frame}) end
  end

  # ── fixture (mirrors backend/test/fixture.mjs) ────────────────────────────

  test "fixture respond echoes the last turn and flags images" do
    {:ok, reply} =
      Fixture.respond(%{
        messages: [%{"role" => "user", "content" => "hello"}],
        emit: emit_collector()
      })

    assert reply == "Sandbox voice reply: hello"
    assert_received {:emitted, %{"type" => "animation", "state" => "tool_running"}}

    {:ok, reply} =
      Fixture.respond(%{
        messages: [
          %{
            "role" => "user",
            "content" => [
              %{"type" => "text", "text" => "look"},
              %{"type" => "image_url", "image_url" => %{"url" => "data:image/png;base64,QQ=="}}
            ]
          }
        ],
        emit: fn _ -> :ok end
      })

    assert reply == "Sandbox voice reply: look [image received]"
  end

  test "fixture transcribe and speak are deterministic; realtime mint refuses" do
    assert {:ok, "Recorded sandbox voice"} = Fixture.transcribe(<<1, 2>>, "audio/webm", %{})

    frame_pid = self()

    assert :ok =
             Fixture.speak("hello", %{emit: fn frame -> send(frame_pid, {:audio, frame}) end})

    assert_receive {:audio, frame}, 100
    assert frame["type"] == "audio"
    assert frame["mimeType"] == "audio/pcm"
    assert frame["sampleRate"] == 24_000
    assert byte_size(Base.decode64!(frame["data"])) == 480

    long_pid = self()
    Fixture.speak("this is long audio", %{emit: fn frame -> send(long_pid, {:audio, frame}) end})

    assert_receive {:audio, long_frame}, 100
    assert byte_size(Base.decode64!(long_frame["data"])) == 192_000

    assert {:error, {"fixture_realtime_unavailable", _}} = Fixture.mint_realtime(%{})
  end

  # ── tool naming and resolution ────────────────────────────────────────────

  test "dotted tool names get deterministic provider-safe aliases" do
    assert Config.function_name("simple-name_1") == "simple-name_1"

    aliased = Config.function_name("Project.Read")
    assert aliased =~ ~r/^tool_[0-9a-f]{24}$/
    assert aliased == Config.function_name("Project.Read")

    tools = [%{"name" => "Project.Read"}]
    assert Config.resolve_tool(tools, aliased) == hd(tools)
    assert Config.resolve_tool(tools, "Project.Read") == hd(tools)
    assert Config.resolve_tool(tools, "Project.Write") == nil
  end

  # ── policy validation (server-side authorizeConfig port) ─────────────────

  defp policy do
    %{
      "organizations" => ["noizu-labs"],
      "projects" => ["noizu-infra"],
      "backends" => ["litellm"],
      "engines" => ["tts"],
      "models" => ["fixture-model"],
      "systemPrompt" => "House voice",
      "allowSystemPrompt" => false,
      "tools" => %{"fixture.echo" => %{"description" => "echo", "invoke" => fn a, _ -> a end}}
    }
  end

  defp requested(overrides \\ %{}) do
    Map.merge(
      %{
        "organization" => "noizu-labs",
        "project" => "noizu-infra",
        "backend" => "litellm",
        "engine" => "tts",
        "model" => "fixture-model"
      },
      overrides
    )
  end

  test "policy normalization resolves the permitted scope and merged tool defs" do
    {:ok, config} =
      Config.authorize_config(
        requested(%{"tools" => ["fixture.echo"], "systemPrompt" => nil, "voice" => "alloy"}),
        policy()
      )

    assert config["systemPrompt"] == "House voice"
    assert config["voice"] == "alloy"
    assert config["ttsModel"] == nil
    assert [%{"name" => "fixture.echo", "description" => "echo"}] = config["tools"]
  end

  test "policy rejects out-of-scope fields, tools, prompts and shapes" do
    assert {:error, 400, "invalid_config", _} = Config.authorize_config(%{}, policy())

    assert {:error, 403, "forbidden", _} =
             Config.authorize_config(requested(%{"organization" => "other"}), policy())

    assert {:error, 403, "forbidden", _} =
             Config.authorize_config(requested(%{"tools" => ["shell.exec"]}), policy())

    assert {:error, 403, "forbidden", _} =
             Config.authorize_config(requested(%{"systemPrompt" => "override"}), policy())

    assert {:error, 400, "invalid_config", _} =
             Config.authorize_config(
               requested(%{"systemPrompt" => String.duplicate("x", 32_001)}),
               policy()
             )

    assert {:error, 400, "invalid_config", _} =
             Config.authorize_config(requested(%{"mcpTools" => "not-a-list"}), policy())

    assert {:error, 403, "forbidden", _} =
             Config.authorize_config(requested(%{"mcpTools" => ["private.read"]}), policy())

    assert {:error, 400, "invalid_config", _} =
             Config.authorize_config(requested(%{"voice" => 1}), policy())
  end

  # ── openai-realtime mint (injected HTTP, no network) ──────────────────────

  test "realtime mint posts the session shape and returns the ephemeral credential" do
    probe = self()

    Application.put_env(:tobor_kit, OpenAIRealtime,
      api_key: "test-only-key",
      base_url: "https://api.openai.test/v1",
      http: fn {:post_json, url, body, headers} ->
        send(probe, {:http, url, Jason.decode!(body), headers})
        {:ok, %{status: 200, body: ~s({"value":"ephemeral-test","expires_at":12345})}}
      end
    )

    config = %{
      "model" => "gpt-realtime-mini",
      "systemPrompt" => "System",
      "voice" => "marin",
      "tools" => [
        %{
          "name" => "Project.Read",
          "description" => "read",
          "inputSchema" => %{"type" => "object"}
        }
      ]
    }

    assert {:ok, credential} = OpenAIRealtime.mint_realtime(config)

    assert credential == %{
             "token" => "ephemeral-test",
             "url" => "https://api.openai.test/v1/realtime/calls",
             "model" => "gpt-realtime-mini",
             "voice" => "marin",
             "expiresAt" => 12_345
           }

    assert_received {:http, url, body, headers}
    headers = Map.new(headers)
    assert url == "https://api.openai.test/v1/realtime/client_secrets"
    assert headers["authorization"] == "Bearer test-only-key"
    assert body["session"]["type"] == "realtime"
    assert body["session"]["model"] == "gpt-realtime-mini"
    assert body["session"]["instructions"] == "System"
    assert body["session"]["audio"]["input"]["turn_detection"]["interrupt_response"] == true
    assert body["session"]["audio"]["input"]["turn_detection"]["create_response"] == true

    assert [%{"name" => name, "parameters" => %{"type" => "object"}}] = body["session"]["tools"]

    assert name == Config.function_name("Project.Read")
  end

  test "realtime mint fails closed without credentials or on provider errors" do
    Application.put_env(:tobor_kit, OpenAIRealtime,
      api_key: "",
      http: fn _ -> flunk("no call expected") end
    )

    assert {:error, {"provider_unconfigured", _}} =
             OpenAIRealtime.mint_realtime(%{"model" => "m"})

    Application.put_env(:tobor_kit, OpenAIRealtime,
      api_key: "test-only-key",
      http: fn _ -> {:ok, %{status: 401, body: "{}"}} end
    )

    assert {:error, {"provider_error", _}} = OpenAIRealtime.mint_realtime(%{"model" => "m"})

    Application.put_env(:tobor_kit, OpenAIRealtime,
      api_key: "test-only-key",
      http: fn _ -> {:ok, %{status: 200, body: "{}"}} end
    )

    assert {:error, {"provider_error", _}} = OpenAIRealtime.mint_realtime(%{"model" => "m"})
  end

  # ── tts engine seams (brain / STT / TTS) ──────────────────────────────────

  defp turn_ctx(extra \\ %{}) do
    Map.merge(
      %{
        config: %{"organization" => "noizu-labs", "project" => "noizu-infra"},
        emit: emit_collector(),
        scope: %{organization: "noizu-labs", project: "noizu-infra"},
        messages: [%{"role" => "user", "content" => "hi"}],
        text: "hi",
        image: nil,
        brain: nil
      },
      Map.new(extra)
    )
  end

  defmodule TestBrain do
    @moduledoc false
    def respond(%{"text" => "hi"}), do: {:ok, "brain says hi"}
    def respond(%{"text" => "boom"}), do: {:error, :exploded}
  end

  test "tts engine answers through the host brain" do
    # the gateway injects the configured brain into the turn ctx
    assert {:error, {"provider_unconfigured", _}} = Tts.respond(turn_ctx())
    assert {:ok, "brain says hi"} = Tts.respond(turn_ctx(brain: TestBrain))

    assert {:error, {code, _}} = Tts.respond(turn_ctx(brain: TestBrain, text: "boom"))
    assert code == "provider_error"
  end

  test "tts engine transcribes through the stt seam and fails closed without it" do
    Application.put_env(:tobor_kit, Tts, stt: fn _data, "audio/webm" -> {:ok, "words"} end)
    assert {:ok, "words"} = Tts.transcribe(<<1>>, "audio/webm", %{})

    Application.put_env(:tobor_kit, Tts, [])
    assert {:error, {"provider_unconfigured", _}} = Tts.transcribe(<<1>>, "audio/webm", %{})
  end

  test "tts engine synthesizes even-length pcm and rejects odd buffers" do
    frame_pid = self()

    Application.put_env(:tobor_kit, Tts, tts: fn _text -> {:ok, <<1, 2, 3, 4>>} end)

    assert :ok = Tts.speak("hello", %{emit: fn frame -> send(frame_pid, {:audio, frame}) end})

    assert_receive {:audio, frame}, 100
    assert frame["mimeType"] == "audio/pcm"
    assert Base.decode64!(frame["data"]) == <<1, 2, 3, 4>>

    Application.put_env(:tobor_kit, Tts, tts: fn _text -> {:ok, <<1, 2, 3>>} end)

    assert {:error, {"provider_error", _}} =
             Tts.speak("hello", %{emit: fn _ -> :ok end})

    Application.put_env(:tobor_kit, Tts, [])
    assert {:error, {"provider_unconfigured", _}} = Tts.speak("hello", %{emit: fn _ -> :ok end})
  end

  test "shared tool invocation runs server-side invoke callbacks only" do
    ctx = %{
      scope: %{organization: "noizu-labs", project: "noizu-infra"},
      config: %{},
      emit: fn _ -> :ok end
    }

    tool = %{
      "name" => "fixture.echo",
      "invoke" => fn args, scope -> {args, scope.organization} end
    }

    assert {:ok, {%{"x" => 1}, "noizu-labs"}} =
             ToborKit.VoiceGateway.Provider.invoke_tool(tool, %{"x" => 1}, ctx)

    assert {:error, {"tool_unconfigured", _}} =
             ToborKit.VoiceGateway.Provider.invoke_tool(%{"name" => "no.adapter"}, %{}, ctx)

    mfa = %{"name" => "mfa", "invoke" => {String, :upcase, []}}
    assert {:ok, "ARG"} = ToborKit.VoiceGateway.Provider.invoke_tool(mfa, "arg", ctx)
  end
end
