defmodule ToborKit.Endpoint do
  @moduledoc """
  The tobor-kit Guide API as a Plug router.

  Plain Plug, no Phoenix. Mount under the host's own domain — typically:

      forward "/api/tobor-kit", to: ToborKit.Endpoint

  Every path, status code, and SSE event name here mirrors
  `openapi/tobor-kit.openapi.yaml`. The stream endpoint answers
  `text/event-stream` with exactly one terminal `message` or `error` event.
  """

  use Plug.Router
  use Plug.ErrorHandler

  require Logger

  plug Plug.Logger
  plug Plug.Head
  plug :match
  plug ToborKit.Endpoint.AuthPlug
  plug :dispatch

  @prefix "/api/tobor-kit"

  # ── guide ─────────────────────────────────────────────────────────────────

  get @prefix <> "/guide" do
    case ToborKit.Guide.Store.guide() do
      {:ok, guide} -> send_json(conn, 200, ToborKit.Guide.projection(guide))
      {:error, _} -> send_json(conn, 404, error("not_found", "No guide is loaded."))
    end
  end

  # ── sessions ──────────────────────────────────────────────────────────────

  post @prefix <> "/sessions" do
    case body_params(conn) do
      {:ok, params} ->
        case open_session(params, conn) do
          {:ok, session} ->
            send_json(conn, 201, ToborKit.Session.serialize(session))

          {:error, :not_found} ->
            send_json(conn, 404, error("not_found", "No such session to resume."))
        end

      {:error, _} ->
        send_json(conn, 400, error("bad_request", "Expected a JSON body."))
    end
  end

  get @prefix <> "/sessions/:id" do
    case ToborKit.Session.Store.get(id) do
      nil -> send_json(conn, 404, error("not_found", "No such session."))
      session -> send_json(conn, 200, ToborKit.Session.serialize(session))
    end
  end

  delete @prefix <> "/sessions/:id" do
    case ToborKit.Session.Store.delete(id) do
      :ok -> send_json(conn, 204, nil)
      :not_found -> send_json(conn, 404, error("not_found", "No such session."))
    end
  end

  # ── turns (SSE) ───────────────────────────────────────────────────────────

  post @prefix <> "/sessions/:id/turn" do
    case body_params(conn) do
      {:ok, %{"input" => input} = params} when is_binary(input) ->
        case ToborKit.Session.Store.get(id) do
          nil ->
            send_json(conn, 404, error("not_found", "No such session."))

          session ->
            case preflight(session, user_id(conn)) do
              :ok ->
                stream_turn(conn, session, input, params)

              {:error, status, code, message} ->
                send_json(conn, status, error(code, message))
            end
        end

      {:ok, _} ->
        send_json(conn, 400, error("bad_request", "`input` is required."))

      {:error, _} ->
        send_json(conn, 400, error("bad_request", "Expected a JSON body."))
    end
  end

  # ── mcp ───────────────────────────────────────────────────────────────────

  get @prefix <> "/mcp/tools" do
    refresh? = conn.query_params["refresh"] in ["true", "1"]

    case ToborKit.Guide.Store.guide() do
      {:ok, guide} ->
        case ToborKit.MCP.inventory(guide, refresh: refresh?) do
          {:ok, inventory} ->
            send_json(conn, 200, inventory)

          {:error, {:required_server_down, server_id}} ->
            send_json(
              conn,
              502,
              error("mcp_required_down", "Required MCP server #{server_id} is unreachable.")
            )
        end

      {:error, _} ->
        send_json(conn, 404, error("not_found", "No guide is loaded."))
    end
  end

  # ── voice ─────────────────────────────────────────────────────────────────

  post @prefix <> "/voice/token" do
    case ToborKit.Guide.Store.guide() do
      {:ok, guide} ->
        case ToborKit.Voice.mint(guide, user_id: user_id(conn)) do
          {:ok, credential} ->
            send_json(conn, 201, credential)

          {:error, :no_credential_needed} ->
            send_json(
              conn,
              409,
              error(
                "no_credential_needed",
                "The configured voice adapter needs no server-minted credential."
              )
            )

          {:error, reason} ->
            Logger.warning("voice token mint failed: #{inspect(reason)}")

            send_json(
              conn,
              503,
              error("voice_unavailable", "Voice is disabled or the provider is unconfigured.")
            )
        end

      {:error, _} ->
        send_json(conn, 404, error("not_found", "No guide is loaded."))
    end
  end

  # ── telemetry consent ─────────────────────────────────────────────────────

  get @prefix <> "/telemetry/consent" do
    with_guide(conn, fn guide ->
      consent = ToborKit.Telemetry.Consent.resolve(user_id(conn), guide.config["telemetry"])
      send_json(conn, 200, consent_serialize(consent))
    end)
  end

  put @prefix <> "/telemetry/consent" do
    case body_params(conn) do
      {:ok, %{"enabled" => enabled}} when is_boolean(enabled) ->
        with_guide(conn, fn guide ->
          user = user_id(conn)

          case ToborKit.Telemetry.Consent.put(user, enabled, guide.config["telemetry"]) do
            :ok ->
              consent = ToborKit.Telemetry.Consent.resolve(user, guide.config["telemetry"])
              send_json(conn, 200, consent_serialize(consent))

            {:error, :not_overridable} ->
              send_json(
                conn,
                403,
                error("not_overridable", "telemetry.user_overridable is false for this guide.")
              )
          end
        end)

      {:ok, _} ->
        send_json(conn, 400, error("bad_request", "`enabled` (boolean) is required."))

      {:error, _} ->
        send_json(conn, 400, error("bad_request", "Expected a JSON body."))
    end
  end

  # ── transcript ────────────────────────────────────────────────────────────

  get @prefix <> "/sessions/:id/transcript" do
    with_session(conn, id, fn _session ->
      store = ToborKit.Transcript.impl()

      if store.backend?() do
        limit = parse_limit(conn.query_params["limit"])
        before = parse_datetime(conn.query_params["before"])
        %{turns: turns, has_more: has_more} = store.list(id, limit, before)

        send_json(conn, 200, %{
          "turns" => Enum.map(turns, &ToborKit.Turn.serialize/1),
          "has_more" => has_more
        })
      else
        send_json(
          conn,
          501,
          error("no_backend_transcript", "This guide does not use the backend transcript store.")
        )
      end
    end)
  end

  delete @prefix <> "/sessions/:id/transcript" do
    with_session(conn, id, fn _session ->
      store = ToborKit.Transcript.impl()

      if store.backend?() do
        store.delete(id)
        send_json(conn, 204, nil)
      else
        send_json(
          conn,
          501,
          error("no_backend_transcript", "This guide does not use the backend transcript store.")
        )
      end
    end)
  end

  # ── health ────────────────────────────────────────────────────────────────

  get @prefix <> "/healthz" do
    send_json(conn, 200, %{"status" => "ok"})
  end

  match _ do
    send_json(conn, 404, error("not_found", "No such route."))
  end

  # ── helpers ───────────────────────────────────────────────────────────────

  defp open_session(params, conn) do
    if resume_id = params["resume_id"] do
      case ToborKit.Session.Store.get(resume_id) do
        nil -> {:error, :not_found}
        session -> {:ok, session}
      end
    else
      {:ok,
       ToborKit.Session.Store.create(%{
         user: conn.private[:tobor_user],
         locale: params["locale"] || "en-US",
         client: params["client"] || "web"
       })}
    end
  end

  defp preflight(session, user) do
    case ToborKit.Budget.check_budget(user) do
      :ok ->
        if session.in_flight do
          {:error, 409, "turn_in_flight", "A turn is already in flight for this session."}
        else
          :ok
        end

      {:error, :budget_exceeded} ->
        {:error, 429, "rate_limited", "Budget exceeded."}
    end
  end

  defp stream_turn(conn, session, input, params) do
    conn =
      conn
      |> put_resp_content_type("text/event-stream")
      |> put_resp_header("cache-control", "no-cache")
      |> send_chunked(200)

    # `chunk/2` returns an updated conn (the test adapter accumulates resp_body
    # there); thread it through via the request process dictionary so the
    # caller of this Plug gets a conn whose body includes every SSE chunk.
    Process.put(:tobor_sse_conn, conn)

    ToborKit.TurnRunner.run(
      session,
      input,
      [
        user_id: user_id(conn),
        task_id: params["task_id"],
        idempotency_key: params["idempotency_key"]
      ],
      fn event ->
        case emit(Process.get(:tobor_sse_conn, conn), event) do
          {:ok, updated} -> Process.put(:tobor_sse_conn, updated)
          _ -> :ok
        end

        :ok
      end
    )

    Process.get(:tobor_sse_conn, conn)
  end

  @doc false
  @spec emit(Plug.Conn.t(), {:event, String.t(), map()}) ::
          {:ok, Plug.Conn.t()} | {:error, term()}
  def emit(conn, {:event, name, data}) do
    payload =
      IO.iodata_to_binary(["event: ", name, "\ndata: ", Jason.encode!(data), "\n\n"])

    chunk(conn, payload)
  end

  defp with_session(conn, id, fun) do
    case ToborKit.Session.Store.get(id) do
      nil -> send_json(conn, 404, error("not_found", "No such session."))
      session -> fun.(session)
    end
  end

  defp with_guide(conn, fun) do
    case ToborKit.Guide.Store.guide() do
      {:ok, guide} -> fun.(guide)
      {:error, _} -> send_json(conn, 404, error("not_found", "No guide is loaded."))
    end
  end

  defp body_params(conn) do
    case conn.body_params do
      %{} = params when is_map(params) -> {:ok, params}
      _ -> {:error, :invalid_body}
    end
  rescue
    _ -> {:error, :invalid_body}
  end

  defp user_id(conn) do
    case conn.private[:tobor_user_id] do
      %{"id" => id} -> id
      id when is_binary(id) -> id
      _ -> "anonymous:" <> client_fingerprint(conn)
    end
  end

  defp client_fingerprint(conn) do
    case get_req_header(conn, "x-tobor-client") do
      [id | _] ->
        id

      [] ->
        Integer.to_string(:erlang.phash2({conn.remote_ip, get_req_header(conn, "user-agent")}))
    end
  end

  defp consent_serialize(%ToborKit.Telemetry.Consent{} = consent) do
    %{
      "enabled" => consent.enabled,
      "source" => consent.source,
      "user_overridable" => consent.user_overridable,
      "capture" => %{
        "prompt" => Map.get(consent.capture, "prompt") == true,
        "response" => Map.get(consent.capture, "response") == true,
        "tool_args" => Map.get(consent.capture, "tool_args") == true,
        "tool_results" => Map.get(consent.capture, "tool_results") == true
      }
    }
  end

  defp parse_limit(raw) do
    case Integer.parse(raw || "") do
      {n, ""} -> min(max(n, 1), 1000)
      _ -> 200
    end
  end

  defp parse_datetime(nil), do: nil

  defp parse_datetime(raw) do
    case DateTime.from_iso8601(raw) do
      {:ok, dt, _} -> dt
      _ -> nil
    end
  end

  defp send_json(conn, status, nil) do
    conn |> put_resp_content_type("application/json") |> send_resp(status, "")
  end

  defp send_json(conn, status, body) do
    conn |> put_resp_content_type("application/json") |> send_resp(status, Jason.encode!(body))
  end

  defp error(code, message), do: %{"code" => code, "message" => message}

  @impl Plug.ErrorHandler
  def handle_errors(conn, %{kind: kind, reason: reason}) do
    Logger.error("tobor_kit endpoint error: #{inspect(kind)} #{inspect(reason)}")

    if conn.state != :sent do
      send_json(conn, 500, error("internal_error", "Internal error."))
    else
      conn
    end
  end
end
