defmodule ToborKit.EndpointTest do
  use ExUnit.Case, async: false

  import Plug.Test
  import Plug.Conn

  @fixture Path.expand("../fixtures/deploy-guide.bundle.json", __DIR__)

  defp load_guide(config \\ %{}) do
    {:ok, _} = ToborKit.Guide.Store.put(@fixture, config)
    :ets.delete_all_objects(:tobor_kit_sessions)
    :ets.delete_all_objects(:tobor_kit_transcripts)
    :ets.delete_all_objects(:tobor_kit_consent)
    :ok
  end

  defp req(method, path, params \\ %{}) do
    conn(method, path, params)
    |> ToborKit.Endpoint.call([])
  end

  describe "GET /healthz" do
    test "answers 200 ok; public regardless of guide auth config" do
      conn = req(:get, "/api/tobor-kit/healthz")

      assert conn.status == 200
      assert Jason.decode!(conn.resp_body) == %{"status" => "ok"}
    end

    test "answers 200 even when the guide requires auth" do
      load_guide(%{"auth" => %{"required" => true}})

      conn = req(:get, "/api/tobor-kit/healthz")

      assert conn.status == 200
      assert Jason.decode!(conn.resp_body) == %{"status" => "ok"}
    end
  end

  describe "GET /guide" do
    test "serves the projection; the compiled preamble never leaves the server" do
      load_guide()
      conn = req(:get, "/api/tobor-kit/guide")

      assert conn.status == 200
      body = Jason.decode!(conn.resp_body)
      assert body["slug"] == "deploy-guide"
      assert String.starts_with?(body["bundle_hash"], "sha256:")

      refute conn.resp_body =~ "NPL@"
      refute conn.resp_body =~ "preamble"
    end
  end

  describe "session lifecycle" do
    test "create, read, resume, close" do
      load_guide()

      conn = req(:post, "/api/tobor-kit/sessions", %{"locale" => "en-US", "client" => "ios"})
      assert conn.status == 201
      session = Jason.decode!(conn.resp_body)
      assert session["state"] == "idle"

      assert req(:get, "/api/tobor-kit/sessions/#{session["id"]}").status == 200

      conn = req(:post, "/api/tobor-kit/sessions", %{"resume_id" => session["id"]})
      assert conn.status == 201
      assert Jason.decode!(conn.resp_body)["id"] == session["id"]

      assert req(:post, "/api/tobor-kit/sessions", %{"resume_id" => ToborKit.UUID.generate()}).status ==
               404

      conn = req(:delete, "/api/tobor-kit/sessions/#{session["id"]}")
      assert conn.status == 204
      assert req(:get, "/api/tobor-kit/sessions/#{session["id"]}").status == 404
    end
  end

  describe "POST /sessions/{id}/turn (SSE)" do
    test "streams the six event names with exactly one terminal event" do
      load_guide()
      session = create_session()
      conn = req(:post, "/api/tobor-kit/sessions/#{session["id"]}/turn", %{"input" => "status?"})

      assert conn.status == 200

      assert get_resp_header(conn, "content-type")
             |> hd()
             |> String.starts_with?("text/event-stream")

      body = sse_body(conn)

      event_names =
        ~r/^event: (\w+)$/m
        |> Regex.scan(body)
        |> Enum.map(&tl/1)
        |> List.flatten()

      assert hd(event_names) == "state"
      assert List.last(event_names) == "message"
      assert Enum.count(event_names, &(&1 in ["message", "error"])) == 1
      assert "delta" in event_names

      # terminal message is a full Turn object
      terminal = terminal_event(body, "message")
      turn = Jason.decode!(terminal)
      assert turn["role"] == "assistant"
      assert String.match?(turn["id"], ~r/^[0-9a-f-]{36}$/)
      assert {:ok, %DateTime{}, _} = DateTime.from_iso8601(turn["created_at"])
    end

    test "unknown session is 404" do
      load_guide()

      conn =
        req(:post, "/api/tobor-kit/sessions/#{ToborKit.UUID.generate()}/turn", %{"input" => "hi"})

      assert conn.status == 404
    end

    test "in-flight turn is 409" do
      load_guide()
      session = create_session()
      stored = ToborKit.Session.Store.get(session["id"])
      ToborKit.Session.Store.update(%{stored | in_flight: true})

      conn = req(:post, "/api/tobor-kit/sessions/#{session["id"]}/turn", %{"input" => "hi"})
      assert conn.status == 409
      assert Jason.decode!(conn.resp_body)["code"] == "turn_in_flight"
    end
  end

  describe "GET /mcp/tools" do
    test "serves the dressed inventory" do
      load_guide(%{"mcp" => mcp_config()})
      :ets.delete_all_objects(:tobor_kit_mcp_cache)

      conn = req(:get, "/api/tobor-kit/mcp/tools")
      assert conn.status == 200

      body = Jason.decode!(conn.resp_body)
      assert %{"groups" => groups, "tools" => tools} = body
      assert Enum.any?(tools, &(&1["name"] == "Github.PullCreate"))
      refute Enum.any?(tools, &(&1["name"] == "Github.PullMerge"))
      assert Enum.map(groups, & &1["id"]) == ["Github", "Ticket", "Session"]
    end

    test "required server down is 502" do
      servers = [%{"id" => "unreachable", "url" => "https://dead/mcp", "required" => true}]
      load_guide(%{"mcp" => Map.put(mcp_config(), "servers", servers)})
      :ets.delete_all_objects(:tobor_kit_mcp_cache)

      conn = req(:get, "/api/tobor-kit/mcp/tools")
      assert conn.status == 502
    end
  end

  describe "POST /voice/token" do
    test "native adapter is a 409" do
      load_guide(%{"voice" => %{"adapter" => "native"}})
      assert req(:post, "/api/tobor-kit/voice/token").status == 409
    end

    test "none adapter is a 503" do
      load_guide(%{"voice" => %{"adapter" => "none"}})
      assert req(:post, "/api/tobor-kit/voice/token").status == 503
    end
  end

  describe "telemetry consent" do
    @overridable %{
      "telemetry" => %{
        "default" => "on",
        "user_overridable" => true,
        "capture" => %{"prompt" => true}
      }
    }

    test "get resolves; put records; source becomes user" do
      load_guide(@overridable)
      client = "consent-test-client"

      conn =
        conn(:get, "/api/tobor-kit/telemetry/consent")
        |> put_req_header("x-tobor-client", client)
        |> ToborKit.Endpoint.call([])

      assert conn.status == 200
      assert %{"enabled" => true, "source" => "default"} = Jason.decode!(conn.resp_body)

      conn =
        conn(:put, "/api/tobor-kit/telemetry/consent", %{"enabled" => false})
        |> put_req_header("x-tobor-client", client)
        |> ToborKit.Endpoint.call([])

      assert conn.status == 200
      assert %{"enabled" => false, "source" => "user"} = Jason.decode!(conn.resp_body)
    end

    test "put 403s when the guide is not user_overridable" do
      load_guide(%{"telemetry" => %{"default" => "on", "user_overridable" => false}})

      conn =
        conn(:put, "/api/tobor-kit/telemetry/consent", %{"enabled" => false})
        |> put_req_header("x-tobor-client", "c1")
        |> ToborKit.Endpoint.call([])

      assert conn.status == 403
      assert Jason.decode!(conn.resp_body)["code"] == "not_overridable"
    end
  end

  describe "transcript endpoints" do
    test "501 for the Memory store (not server-backed)" do
      load_guide(%{"transcript" => %{"store" => "memory"}})
      session = create_session()

      conn = req(:get, "/api/tobor-kit/sessions/#{session["id"]}/transcript")
      assert conn.status == 501
      assert Jason.decode!(conn.resp_body)["code"] == "no_backend_transcript"

      conn = req(:delete, "/api/tobor-kit/sessions/#{session["id"]}/transcript")
      assert conn.status == 501
    end
  end

  describe "auth gate" do
    test "auth.required blocks unauthenticated calls but /guide stays open" do
      load_guide(%{"auth" => %{"required" => true, "provider" => "authentik"}})

      assert req(:get, "/api/tobor-kit/guide").status == 200

      conn = req(:get, "/api/tobor-kit/telemetry/consent")
      assert conn.status == 401
      assert Jason.decode!(conn.resp_body)["code"] == "unauthorized"

      conn =
        conn(:post, "/api/tobor-kit/sessions", %{})
        |> put_req_header("authorization", "Bearer some-token")
        |> ToborKit.Endpoint.call([])

      assert conn.status == 201
    end
  end

  # ── helpers ───────────────────────────────────────────────────────────────

  defp create_session do
    conn = req(:post, "/api/tobor-kit/sessions", %{})
    Jason.decode!(conn.resp_body)
  end

  # The Plug test adapter either accumulates chunks into resp_body or sends
  # them as messages; handle both shapes.
  defp sse_body(conn) do
    drained = drain_chunks()
    conn.resp_body <> drained
  end

  defp drain_chunks(acc \\ []) do
    receive do
      {:plug_conn, :chunk, data} when is_binary(data) -> drain_chunks([data | acc])
      {_, _} -> drain_chunks(acc)
      _ -> drain_chunks(acc)
    after
      50 -> acc |> Enum.reverse() |> IO.iodata_to_binary()
    end
  end

  defp terminal_event(body, name) do
    blocks = String.split(body, "\n\n", trim: true)

    block =
      Enum.find(blocks, fn block ->
        String.contains?(block, "event: #{name}")
      end)

    case block do
      nil ->
        nil

      _ ->
        block
        |> String.split("\n")
        |> Enum.find(&String.starts_with?(&1, "data: "))
        |> String.slice(6..-1//1)
    end
  end

  defp mcp_config do
    %{
      "servers" => [
        %{
          "id" => "tobor",
          "url" => "https://tobor.locker/mcp",
          "label" => "Tobor",
          "required" => true
        }
      ],
      "allow" => ["Github.*", "Ticket.*", "Session.*"],
      "deny" => ["Github.PullMerge"],
      "menu" => %{
        "group_by" => "category",
        "order" => ["Github", "Ticket", "Session"],
        "overrides" => %{}
      }
    }
  end
end
