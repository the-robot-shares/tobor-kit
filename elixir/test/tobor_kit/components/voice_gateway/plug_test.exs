defmodule ToborKit.VoiceGateway.PlugTest do
  @moduledoc """
  Contract tests for the HTTP surface, mirroring `backend/test/server.test.mjs`:
  policy escalation, origin/auth/ticket enforcement, session shape, capacity,
  CORS preflight, oversized bodies and expired sessions.
  """

  use ExUnit.Case, async: false

  import Plug.Conn
  import Plug.Test

  alias ToborKit.VoiceGateway.{Plug, Store}

  @base_url "http://backend.test/voice/sessions"

  defmodule RealtimeStub do
    @moduledoc false
    @behaviour ToborKit.VoiceGateway.Provider

    @impl true
    def mint_realtime(_config) do
      send(:vgw_plug_test_probe, :minted)

      {:ok,
       %{
         "token" => "ephemeral-test",
         "url" => "https://api.openai.test/v1/realtime/calls",
         "model" => "gpt-realtime-mini",
         "voice" => "marin",
         "expiresAt" => 1_234_567
       }}
    end

    @impl true
    def respond(_ctx), do: {:ok, "stub"}

    @impl true
    def transcribe(_d, _m, _ctx), do: {:ok, "stub"}

    @impl true
    def speak(_t, _ctx), do: :ok

    @impl true
    def invoke_tool(t, a, c), do: ToborKit.VoiceGateway.Provider.invoke_tool(t, a, c)
  end

  defmodule RealtimeRefusing do
    @moduledoc false
    @behaviour ToborKit.VoiceGateway.Provider

    @impl true
    def mint_realtime(_config),
      do: {:error, {"fixture_realtime_unavailable", "no real credentials"}}

    @impl true
    def respond(_ctx), do: {:ok, "stub"}

    @impl true
    def transcribe(_d, _m, _ctx), do: {:ok, "stub"}

    @impl true
    def speak(_t, _ctx), do: :ok

    @impl true
    def invoke_tool(t, a, c), do: ToborKit.VoiceGateway.Provider.invoke_tool(t, a, c)
  end

  setup do
    :ets.delete_all_objects(:tobor_kit_vgw_sessions)
    :ets.delete_all_objects(:tobor_kit_vgw_tickets)
    Process.register(self(), :vgw_plug_test_probe)

    configure(
      token: "test-token",
      origins: ["http://allowed.test"],
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
          "invoke" => fn args, _scope -> args end
        }
      }
    }
  end

  defp configure(opts) do
    Application.put_env(:tobor_kit, ToborKit.VoiceGateway,
      provider: Keyword.get(opts, :provider, ToborKit.VoiceGateway.Providers.Fixture),
      brain: opts[:brain],
      auth: Keyword.get(opts, :auth, ToborKit.VoiceGateway.Auth.Bearer),
      allowed_origins: Keyword.get(opts, :origins, []),
      public_url: opts[:public_url],
      session_ttl_ms: Keyword.get(opts, :ttl, 30 * 60_000),
      max_sessions: Keyword.get(opts, :max_sessions, 100),
      max_payload: Keyword.get(opts, :max_payload, 8 * 1024 * 1024)
    )

    Application.put_env(:tobor_kit, ToborKit.VoiceGateway.Auth.Bearer,
      token: opts[:token],
      policy: opts[:policy]
    )
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

  defp post(body, headers) do
    raw_post(body, [{"authorization", "Bearer test-token"} | headers])
  end

  defp post_unauthenticated(body, headers), do: raw_post(body, headers)

  defp raw_post(body, headers) do
    conn(:post, @base_url, body)
    |> put_req_header("content-type", "application/json")
    |> merge_send_headers(headers)
    |> Plug.call([])
  end

  defp merge_send_headers(conn, headers) do
    Enum.reduce(headers, conn, fn {k, v}, acc -> put_req_header(acc, k, v) end)
  end

  defp get(path, headers \\ []) do
    conn(:get, "http://backend.test" <> path, nil)
    |> merge_send_headers(headers)
    |> Plug.call([])
  end

  defp json(conn), do: Jason.decode!(conn.resp_body)

  defp create_session(overrides \\ %{}, headers \\ []) do
    conn = post(Jason.encode!(config(overrides)), [{"origin", "http://allowed.test"} | headers])
    assert conn.status == 201
    json(conn)
  end

  test "session scope and tool policy reject escalation" do
    for bad <- [
          %{"organization" => "other"},
          %{"project" => "other"},
          %{"backend" => "other"},
          %{"engine" => "realtime-bogus"},
          %{"model" => "unapproved"},
          %{"tools" => ["shell.exec"]},
          %{"mcpTools" => ["private.read"]},
          %{"tools" => [%{"name" => "fixture.echo", "endpoint" => "https://evil.test"}]},
          %{"voice" => 123},
          %{"ttsModel" => String.duplicate("x", 129)}
        ] do
      assert %{status: status} = post(Jason.encode!(config(bad)), origin_header())
      assert status in [400, 403], "expected 400/403 for #{inspect(bad)}, got #{status}"
    end

    assert %{status: 201} = post(Jason.encode!(config()), origin_header())
  end

  test "system prompt override is rejected when policy disallows it" do
    configure(
      token: "test-token",
      origins: ["http://allowed.test"],
      policy:
        Map.merge(policy(), %{"allowSystemPrompt" => false, "systemPrompt" => "House voice"})
    )

    assert %{status: 403} = post(Jason.encode!(config()), origin_header())

    allowed = post(Jason.encode!(config(%{"systemPrompt" => nil})), origin_header())
    assert allowed.status == 201
  end

  test "origin, authentication and single-use socket ticket enforced" do
    denied = get("/voice/sessions", [{"origin", "https://evil.test"}])
    assert denied.status == 403
    assert json(denied) == %{"code" => "origin_denied", "message" => "Origin denied"}

    conn = post(Jason.encode!(config()), [{"origin", "http://allowed.test"}])
    assert conn.status == 201
    assert get_resp_header(conn, "access-control-allow-origin") == ["http://allowed.test"]
    assert get_resp_header(conn, "access-control-allow-credentials") == ["true"]

    # no Origin header (server-to-server) passes the origin gate; auth still applies
    assert %{status: 401} = post_unauthenticated(Jason.encode!(config()), [])

    # 401 when authorize returns nil
    configure(
      token: "different-token",
      origins: ["http://allowed.test"],
      policy: policy()
    )

    conn = post(Jason.encode!(config()), origin_header())
    assert conn.status == 401
    assert json(conn)["code"] == "unauthorized"

    # ticket single use: first upgrade accepted, second rejected
    configure(token: "test-token", origins: ["http://allowed.test"], policy: policy())
    reply = create_session()
    %{path: path, query: query} = URI.parse(reply["websocketUrl"])

    assert %{state: :upgraded, halted: true} =
             get(path <> "?" <> query) |> then(fn c -> %{state: c.state, halted: c.halted} end)

    assert %{status: 403} = get(path <> "?" <> query)
  end

  test "websocket upgrade rejects unknown, expired, attached sessions and bad tickets" do
    reply = create_session()
    %{path: path, query: query} = URI.parse(reply["websocketUrl"])
    session_id = reply["sessionId"]

    assert %{status: 403} = get(path <> "?ticket=wrong-ticket")
    assert %{status: 403} = get(path)

    assert %{status: 403} =
             get("/voice/sessions/00000000-0000-4000-8000-000000000000/socket?ticket=x")

    # an already-attached session is unreconnectable — new session per reconnect
    assert {:ok, _row} = Store.attach(session_id, self())
    assert %{status: 403} = get(path <> "?" <> query)

    # expired sessions are refused
    reply = create_session(%{}, [])
    %{path: path, query: query} = URI.parse(reply["websocketUrl"])
    ticket = URI.decode_query(query)["ticket"]

    Store.put_session(%{
      session_id: reply["sessionId"],
      config: %{},
      ticket: ticket,
      expires_at: 1,
      pid: nil
    })

    assert %{status: 403} = get(path <> "?" <> query)
  end

  test "expired TTL is refused at create-then-upgrade" do
    configure(token: "test-token", origins: ["http://allowed.test"], policy: policy(), ttl: 0)
    reply = create_session()
    %{path: path, query: query} = URI.parse(reply["websocketUrl"])
    assert %{status: 403} = get(path <> "?" <> query)
  end

  test "text and screenshot sessions return contract-shaped 201 payloads" do
    reply = create_session()

    assert reply["sessionId"] =~ ~r/[0-9a-f-]{36}/
    assert reply["expiresAt"] =~ ~r/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    assert reply["realtime"] == nil

    uri = URI.parse(reply["websocketUrl"])
    assert uri.scheme == "ws"
    assert uri.host == "backend.test"
    assert uri.path == "/voice/sessions/#{reply["sessionId"]}/socket"
    assert URI.decode_query(uri.query)["ticket"] != nil
  end

  test "public_url yields absolute wss URLs for reverse-proxy deployments" do
    configure(
      token: "test-token",
      origins: ["http://allowed.test"],
      policy: policy(),
      public_url: "https://voice.public.test"
    )

    reply = create_session()
    uri = URI.parse(reply["websocketUrl"])
    assert uri.scheme == "wss"
    assert uri.host == "voice.public.test"
    assert uri.path == "/voice/sessions/#{reply["sessionId"]}/socket"
  end

  test "realtime credentials are minted only for the openai-realtime engine" do
    configure(
      token: "test-token",
      origins: ["http://allowed.test"],
      policy: policy(),
      provider: RealtimeStub
    )

    refute_received :minted
    tts_reply = create_session(%{"engine" => "tts", "model" => "fixture-model"})
    refute_received :minted
    refute Map.has_key?(tts_reply, "realtime")

    realtime_reply =
      create_session(%{"engine" => "openai-realtime", "model" => "gpt-realtime-mini"})

    assert_received :minted

    assert realtime_reply["realtime"] == %{
             "token" => "ephemeral-test",
             "url" => "https://api.openai.test/v1/realtime/calls",
             "model" => "gpt-realtime-mini",
             "voice" => "marin",
             "expiresAt" => 1_234_567
           }

    # coded provider failures surface as 400 with the provider's code
    configure(
      token: "test-token",
      origins: ["http://allowed.test"],
      policy: policy(),
      provider: RealtimeRefusing
    )

    conn = post(Jason.encode!(config(%{"engine" => "openai-realtime"})), origin_header())
    assert conn.status == 400

    assert json(conn) == %{
             "code" => "fixture_realtime_unavailable",
             "message" => "no real credentials"
           }
  end

  test "capacity ceiling answers 429" do
    configure(
      token: "test-token",
      origins: ["http://allowed.test"],
      policy: policy(),
      max_sessions: 1
    )

    reply = create_session()
    conn = post(Jason.encode!(config()), origin_header())
    assert conn.status == 429
    assert json(conn)["code"] == "capacity"

    Store.delete_session(reply["sessionId"])
    assert %{status: 201} = post(Jason.encode!(config()), origin_header())
  end

  test "malformed bodies, unknown paths and oversized bodies fail closed" do
    conn = post("{", origin_header())
    assert conn.status == 400
    assert json(conn)["code"] == "invalid_request"

    conn = post("[1,2,3]", origin_header())
    assert conn.status == 400
    assert json(conn)["code"] == "invalid_request"

    conn = get("/elsewhere")
    assert conn.status == 404
    assert json(conn)["code"] == "not_found"

    conn = get("/health")
    assert conn.status == 200
    assert json(conn) == %{"ok" => true}

    huge = Jason.encode!(config(%{"systemPrompt" => String.duplicate("x", 70_000)}))
    conn = post(huge, origin_header())
    assert conn.status == 400

    assert json(conn) == %{
             "code" => "invalid_config",
             "message" => "Configuration is too large"
           }
  end

  test "CORS preflight answers 204 for allowlisted origins only" do
    conn =
      conn(:options, @base_url, nil)
      |> put_req_header("origin", "http://allowed.test")
      |> Plug.call([])

    assert conn.status == 204
    assert get_resp_header(conn, "access-control-allow-methods") == ["POST, OPTIONS"]

    assert %{status: 403} =
             conn(:options, @base_url, nil)
             |> put_req_header("origin", "https://evil.test")
             |> Plug.call([])
  end

  defp origin_header, do: [{"origin", "http://allowed.test"}]
end
